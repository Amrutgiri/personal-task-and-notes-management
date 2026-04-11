const { google } = require('googleapis');
const DailyNote = require('../models/DailyNote');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
  }

  /**
   * Initialize Google Sheets API with service account credentials
   */
  async init() {
    try {
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;

      if (!clientEmail || !privateKey) {
        throw new Error('Google Cloud credentials missing (GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY)');
      }

      const cleanKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: cleanKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (err) {
      console.error('Failed to initialize Google Sheets Service:', err.message);
      throw err;
    }
  }

  /**
   * Data Cleaning Utility
   */
  cleanField(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  /**
   * Row Validation Helper
   * Updated to handle UID at index 0
   */
  validateRow(row) {
    // 1. Column Safety: Ensure row has at least 7 columns (UID + 6 data)
    if (!row || row.length < 7) { 
      return { isValid: false, reason: 'Skipped invalid row: insufficient columns' };
    }

    // UID is at 0, Date is at 1, Project is at 2, Title is at 3, Start Desc is at 4
    const dateStr = this.cleanField(row[1]);
    const projectName = this.cleanField(row[2]);
    const taskTitle = this.cleanField(row[3]);
    const dayStartDesc = this.cleanField(row[4]);

    // 2. Skip empty rows
    if (!dateStr && !projectName && !taskTitle) {
      return { isValid: false, reason: 'Skipped empty row' };
    }

    // 3. Skip header row (if matches "Date" at index 1 or "UID" at index 0)
    if (dateStr.toLowerCase() === 'date' || this.cleanField(row[0]).toLowerCase() === 'uid') {
      return { isValid: false, reason: 'Skipped header row' };
    }

    // 4. Detect valid data row by comma in Date column (index 1)
    if (!dateStr.includes(',')) {
      if (dateStr.includes('-')) {
        return { isValid: false, reason: 'Skipped month header: ' + dateStr };
      }
      return { isValid: false, reason: 'Skipped invalid row: no date format detected' };
    }

    // 5. Check required fields for DailyNote validation
    if (!projectName || !taskTitle || !dayStartDesc) {
      return { isValid: false, reason: 'Skipped invalid row: missing required fields' };
    }

    return { isValid: true, reason: null };
  }

  /**
   * Parse full date string "Monday, March 2, 2026" back to Date object
   */
  parseDate(dateString) {
    try {
      const parts = dateString.split(',').map(s => s.trim());
      if (parts.length < 3) return null;
      const monthDay = parts[1].split(' '); 
      const year = parts[2];
      const month = monthDay[0];
      const day = monthDay[1];
      const d = new Date(`${month} ${day}, ${year}`);
      return isNaN(d.getTime()) ? null : d;
    } catch (err) {
      return null;
    }
  }

  /**
   * Preview Import: Returns counts and valid data without inserting
   */
  async getImportPreview(user) {
    await this.init();
    const spreadsheetId = user.googleSpreadsheetId;
    const sheetName = user.googleSheetName || 'Sheet1';

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:H`, // UID + 7 data columns
    });

    const rows = response.data.values || [];
    const summary = { totalRows: rows.length, validRows: 0, skippedRows: 0, reasons: {} };
    const validData = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validation = this.validateRow(row);

      if (!validation.isValid) {
        summary.skippedRows++;
        summary.reasons[validation.reason] = (summary.reasons[validation.reason] || 0) + 1;
        continue;
      }

      const dateObj = this.parseDate(this.cleanField(row[1]));
      if (!dateObj) {
        summary.skippedRows++;
        summary.reasons['Skipped invalid row: date parsing failed'] = (summary.reasons['Skipped invalid row: date parsing failed'] || 0) + 1;
        continue;
      }

      // Status mapping: "In Progress" -> "InProgress"
      let status = this.cleanField(row[6]) || 'Pending';
      if (status === 'In Progress') status = 'InProgress';

      const entry = {
        date: dateObj,
        project_name: this.cleanField(row[2]),
        task_title: this.cleanField(row[3]),
        day_start_description: this.cleanField(row[4]),
        day_end_description: this.cleanField(row[5]),
        status: status,
        remarks: this.cleanField(row[7]) || '',
        is_synced: true,
        synced_at: new Date()
      };

      // Only add _id if it's a valid 24-char hex string (MongoDB ID)
      const uid = this.cleanField(row[0]);
      if (uid && uid.length === 24) {
        entry._id = uid;
      }

      validData.push(entry);
      summary.validRows++;
    }

    return { summary, validData };
  }

  /**
   * Sync notes to Google Sheets (Export)
   */
  async syncNotes(user, notes) {
    await this.init();
    const spreadsheetId = user.googleSpreadsheetId;
    const sheetName = user.googleSheetName || 'Sheet1';

    const sortedNotes = [...notes].sort((a, b) => new Date(a.date) - new Date(b.date));

    let existingRows = [];
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:D`, // Check UID, Date, Project, Title
      });
      existingRows = response.data.values || [];
    } catch (err) {
      console.log('Note: Could not fetch existing rows.');
    }
    
    if (existingRows.length === 0) {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        resource: { 
          values: [['UID', 'Date', 'Project Name', 'Task Title', 'Day Start Task Description', 'Day End Task Description', 'Status', 'Remarks/Notes']] 
        },
      });
      existingRows.push(['UID', 'Date', 'Project Name', 'Task Title']);
    }

    // Existing keys for duplicate check: FormattedDate|Project|Title
    const existingKeys = new Set(existingRows.map(row => `${row[1]}|${row[2]}|${row[3]}`));
    const groupedNotes = {};
    sortedNotes.forEach(note => {
      const monthHeader = this.formatMonthHeader(note.date);
      if (!groupedNotes[monthHeader]) groupedNotes[monthHeader] = [];
      groupedNotes[monthHeader].push(note);
    });

    const syncSummary = { total: notes.length, synced: 0, skipped: 0 };

    for (const monthHeader of Object.keys(groupedNotes)) {
      const fullSheetResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:B`,
      });
      const allRowsA = fullSheetResponse.data.values || [];
      const monthExists = allRowsA.some(row => row[1] === monthHeader || row[0] === monthHeader);

      if (!monthExists) {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:B`,
          valueInputOption: 'RAW',
          resource: { values: [['', monthHeader]] }, // Month header shifted to index 1 (B)
        });
      }

      const notesToSync = groupedNotes[monthHeader].filter(note => {
        const formattedDate = this.formatFullDate(note.date);
        const key = `${formattedDate}|${note.project_name}|${note.task_title}`;
        if (existingKeys.has(key)) {
          syncSummary.skipped++;
          return false;
        }
        return true;
      });

      if (notesToSync.length === 0) continue;

      const rowsToInsert = notesToSync.map(note => {
        const cleanHtml = (html) => {
          if (!html) return '';
          return html.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]*>/g, '').trim();
        };

        return [
          note._id.toString(), // Column A: UID
          this.formatFullDate(note.date),
          note.project_name,
          note.task_title,
          cleanHtml(note.day_start_description),
          cleanHtml(note.day_end_description),
          note.status,
          note.remarks || ''
        ];
      });

      const appendResponse = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        resource: { values: rowsToInsert },
      });

      const updatedRange = appendResponse.data.updates.updatedRange;
      const match = updatedRange.match(/!A(\d+):H(\d+)/);
      if (match) {
        const startRow = parseInt(match[1]) - 1;
        await this.applyFormatting(spreadsheetId, sheetName, startRow, notesToSync);
      }
      syncSummary.synced += notesToSync.length;
    }

    return syncSummary;
  }

  /**
   * Backfill UID column in Google Sheet with MongoDB _ids
   */
  async backfillUIDToSheet(user) {
    await this.init();
    const spreadsheetId = user.googleSpreadsheetId;
    const sheetName = user.googleSheetName || 'Sheet1';

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`, // Read UID, Date, Project, Title
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return { updated: 0, total: 0 };

    const dataRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip Row 1 (header) if it contains 'UID' or 'Date'
      if (i === 0 && (this.cleanField(row[0]).toLowerCase() === 'uid' || this.cleanField(row[1]).toLowerCase() === 'date')) continue;
      
      const dateStr = this.cleanField(row[1]);
      const projectName = this.cleanField(row[2]);
      const taskTitle = this.cleanField(row[3]);
      
      // Basic check for data row (date contains comma)
      if (dateStr.includes(',') && projectName && taskTitle) {
        dataRows.push({ rowIndex: i, uid: this.cleanField(row[0]), dateStr, projectName, taskTitle });
      }
    }

    const updateRequests = [];
    for (const item of dataRows) {
      if (item.uid) continue; // Already has UID

      const dateObj = this.parseDate(item.dateStr);
      if (!dateObj) continue;

      // Find in DB
      const match = await DailyNote.findOne({
        user: user._id,
        date: { 
          $gte: new Date(dateObj).setHours(0,0,0,0), 
          $lte: new Date(dateObj).setHours(23,59,59,999) 
        },
        project_name: item.projectName,
        task_title: item.taskTitle
      });

      if (match) {
        updateRequests.push({
          range: `${sheetName}!A${item.rowIndex + 1}`,
          values: [[match._id.toString()]]
        });
      }
    }

    if (updateRequests.length > 0) {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updateRequests
        }
      });
    }

    return { updated: updateRequests.length, total: dataRows.length };
  }

  async applyFormatting(spreadsheetId, sheetName, startRow, notesInserted) {
    const sheetMetadata = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetMetadata.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) return;

    const sheetId = sheet.properties.sheetId;
    const requests = notesInserted.map((note, index) => {
      const rowIndex = startRow + index;
      let backgroundColor = null;
      if (note.status === 'Completed') backgroundColor = { red: 0.85, green: 0.92, blue: 0.83 };
      else if (note.status === 'Pending') backgroundColor = { red: 0.96, green: 0.80, blue: 0.80 };

      if (backgroundColor) {
        return {
          repeatCell: {
            range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 8 }, // 8 columns (A-H)
            cell: { userEnteredFormat: { backgroundColor } },
            fields: 'userEnteredFormat.backgroundColor'
          }
        };
      }
      return null;
    }).filter(r => r !== null);

    if (requests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
    }
  }

  formatFullDate(date) {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatMonthHeader(date) {
    const d = new Date(date);
    return `${d.toLocaleDateString('en-US', { month: 'long' })}-${d.getFullYear()}`;
  }
}

module.exports = new GoogleSheetsService();