document.addEventListener('DOMContentLoaded', () => {
    const board = document.querySelector('[data-kanban-board]');
    if (!board) {
        return;
    }

    let activeCard = null;

    board.querySelectorAll('.kanban-card').forEach((card) => {
        card.addEventListener('dragstart', () => {
            activeCard = card;
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            activeCard = null;
        });
    });

    board.querySelectorAll('.kanban-dropzone').forEach((zone) => {
        zone.addEventListener('dragover', (event) => {
            event.preventDefault();
            zone.classList.add('is-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('is-over');
        });

        zone.addEventListener('drop', async (event) => {
            event.preventDefault();
            zone.classList.remove('is-over');
            if (!activeCard) {
                return;
            }

            const column = zone.closest('.kanban-column');
            zone.appendChild(activeCard);

            try {
                const response = await fetch(`/tasks/${activeCard.dataset.taskId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: column.dataset.status })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Failed to update task.');
                }
            } catch (error) {
                Swal.fire('Update failed', error.message, 'error');
                window.location.reload();
            }
        });
    });
});
