document.addEventListener('DOMContentLoaded', () => {
    window.appEditors = window.appEditors || {};
    const editors = document.querySelectorAll('.editor');
    editors.forEach(editor => {
        ClassicEditor
            .create(editor, {
                toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'undo', 'redo'],
            })
            .then(instance => {
                if (editor.id) {
                    window.appEditors[editor.id] = instance;
                }
            })
            .catch(error => {
                console.error(error);
            });
    });
});
