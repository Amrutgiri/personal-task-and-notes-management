document.addEventListener('DOMContentLoaded', function () {
  const exportForms = document.querySelectorAll('.export-form');

  exportForms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const format = form.querySelector('[name="format"]')?.value || 'xlsx';
      const resource = form.querySelector('[name="resource"]')?.value || 'daily-notes';
      const params = new URLSearchParams(new FormData(form));
      const exportUrl = `/export?${params.toString()}`;

      const { isConfirmed } = await Swal.fire({
        title: 'Prepare export?',
        text: `Download ${resource.replace('-', ' ')} as ${format.toUpperCase()}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Download',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#198754'
      });

      if (!isConfirmed) {
        return;
      }

      window.location.href = exportUrl;
    });
  });
});
