// Custom Scripts
document.addEventListener('DOMContentLoaded', function() {
    // Password show / hide toggle
    document.addEventListener('click', function (e) {
        const toggle = e.target.closest('[data-password-toggle]');
        if (!toggle) return;

        const input = document.querySelector(toggle.dataset.passwordToggle);
        if (!input) return;

        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';

        const icon = toggle.querySelector('i');
        if (icon) icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';

        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        input.focus({ preventScroll: true });
    });

    // Initialize Feather Icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('main-wrapper');
    const toggleBtns = document.querySelectorAll('.sidebar-toggle');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.toggle('collapsed');
                mainWrapper.classList.toggle('expanded');
            } else {
                sidebar.classList.toggle('mobile-show');
            }
        });
    });

    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });

    // Google Sheets Sync
    const syncBtn = document.getElementById('sync-google-sheets');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const startDate = document.querySelector('input[name="startDate"]')?.value;
            const endDate = document.querySelector('input[name="endDate"]')?.value;

            const { value: confirm } = await Swal.fire({
                title: 'Sync to Google Sheets?',
                text: "This will export the currently filtered notes to your Google Sheet. Duplicates will be skipped.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#198754',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, sync now!',
                showLoaderOnConfirm: true,
                preConfirm: async () => {
                    try {
                        const response = await fetch('/daily-notes/sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ startDate, endDate })
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.message || 'Sync failed');
                        return data;
                    } catch (error) {
                        Swal.showValidationMessage(`Request failed: ${error}`);
                    }
                },
                allowOutsideClick: () => !Swal.isLoading()
            });

            if (confirm && confirm.success) {
                Swal.fire({
                    title: 'Sync Successful!',
                    text: confirm.message,
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
            }
        });
    }

    // Google Sheets Import
    const importBtn = document.getElementById('import-google-sheets');
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            // Step 1: Preview
            Swal.fire({
                title: 'Analyzing Sheet...',
                text: 'Please wait while we scan your Google Sheet.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const previewRes = await fetch('/daily-notes/preview-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const previewData = await previewRes.json();

                if (!previewRes.ok) throw new Error(previewData.message || 'Preview failed');

                const { summary } = previewData;
                
                // Construct reason list for irregularity
                let reasonHtml = '<ul class="text-start small mt-3">';
                for (const [reason, count] of Object.entries(summary.reasons)) {
                    reasonHtml += `<li>${reason}: <strong>${count}</strong></li>`;
                }
                reasonHtml += '</ul>';

                // Step 2: Confirmation
                const { value: confirm } = await Swal.fire({
                    title: 'Import Preview',
                    html: `
                        <div class="text-center mb-3">
                            <span class="badge bg-success rounded-pill px-3 py-2 fs-6">Valid Rows: ${summary.validRows}</span>
                            <span class="badge bg-warning rounded-pill px-3 py-2 fs-6 text-dark">Skipped: ${summary.skippedRows}</span>
                        </div>
                        <p class="text-muted small">We found ${summary.validRows} valid data entries to process. Irregular rows like headers and empty lines will be ignored.</p>
                        ${reasonHtml}
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: '#4f46e5',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Proceed with Import',
                    showLoaderOnConfirm: true,
                    preConfirm: async () => {
                        try {
                            const response = await fetch('/daily-notes/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.message || 'Import failed');
                            return data;
                        } catch (error) {
                            Swal.showValidationMessage(`Request failed: ${error}`);
                        }
                    },
                    allowOutsideClick: () => !Swal.isLoading()
                });

                if (confirm && confirm.success) {
                    Swal.fire({
                        title: 'Import Complete!',
                        html: `
                            <div class="text-start">
                                <p>Successfully processed Google Sheet:</p>
                                <ul>
                                    <li>New Records: <strong>${confirm.summary.imported}</strong></li>
                                    <li>Duplicates (Skipped): <strong>${confirm.summary.duplicates}</strong></li>
                                    <li>Failed Rows: <strong>${confirm.summary.failed}</strong></li>
                                </ul>
                            </div>
                        `,
                        icon: 'success',
                        confirmButtonColor: '#4f46e5'
                    }).then(() => {
                        window.location.reload();
                    });
                }
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    // Backfill UIDs
    const backfillBtn = document.getElementById('backfill-uids-btn');
    if (backfillBtn) {
        backfillBtn.addEventListener('click', async () => {
            const { value: confirm } = await Swal.fire({
                title: 'Backfill UIDs to Sheet?',
                text: "This will scan your Google Sheet and fill in missing UIDs (MongoDB IDs) for matching records. Existing data will not be changed.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, start backfill',
                showLoaderOnConfirm: true,
                preConfirm: async () => {
                    try {
                        const response = await fetch('/daily-notes/backfill-uids', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.message || 'Backfill failed');
                        return data;
                    } catch (error) {
                        Swal.showValidationMessage(`Request failed: ${error}`);
                    }
                },
                allowOutsideClick: () => !Swal.isLoading()
            });

            if (confirm && confirm.success) {
                Swal.fire({
                    title: 'Backfill Complete!',
                    text: confirm.message,
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
            }
        });
    }

    // Google Sheets Settings Modal
    const settingsBtn = document.getElementById('sync-settings-btn');
    const settingsForm = document.getElementById('sync-settings-form');
    if (settingsBtn && settingsForm) {
        const modal = new bootstrap.Modal(document.getElementById('syncSettingsModal'));
        
        settingsBtn.addEventListener('click', () => {
            modal.show();
        });

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/daily-notes/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.success) {
                    modal.hide();
                    Swal.fire({
                        title: 'Success!',
                        text: result.message,
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    document.querySelectorAll('canvas[data-chart]').forEach((canvas) => {
        if (typeof Chart === 'undefined') {
            return;
        }

        const labels = JSON.parse(canvas.dataset.chartLabels || '[]');
        const values = JSON.parse(canvas.dataset.chartValues || '[]');
        const secondaryValues = JSON.parse(canvas.dataset.chartSecondaryValues || '[]');
        const type = canvas.dataset.chart || 'bar';
        const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

        const datasets = [{
            label: 'Value',
            data: values,
            backgroundColor: type === 'line' ? 'rgba(79, 70, 229, 0.16)' : palette,
            borderColor: '#4f46e5',
            borderWidth: 2,
            tension: 0.35,
            fill: type === 'line'
        }];

        if (secondaryValues.length) {
            datasets[0].label = 'Total';
            datasets.push({
                label: 'Completed',
                data: secondaryValues,
                backgroundColor: '#10b981'
            });
        }

        new Chart(canvas, {
            type,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: ['bar', 'line'].includes(type) ? {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                } : {}
            }
        });
    });
});

/**
 * Global function for delete confirmation
 * @param {Event} e - The event object
 */
function confirmDelete(e) {
    e.preventDefault();
    const form = e.target.closest('form');
    
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!',
      customClass: {
          confirmButton: 'btn btn-primary',
          cancelButton: 'btn btn-danger'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        form.submit();
      }
    });
}
