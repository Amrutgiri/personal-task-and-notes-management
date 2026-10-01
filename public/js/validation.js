(function ($) {
  if (!$ || !$.validator) {
    return;
  }

  const CKEDITOR_FIELDS = [
    'description',
    'day_start_description',
    'day_end_description'
  ];

  const syncEditorValue = (fieldName) => {
    const element = document.querySelector(`[name="${fieldName}"]`);
    if (!element || !window.appEditors || !element.id || !window.appEditors[element.id]) {
      return;
    }

    element.value = window.appEditors[element.id].getData();
  };

  const stripHtml = (value) => $('<div>').html(value || '').text().replace(/\s+/g, ' ').trim();

  const toggleEditorState = (element, isValid) => {
    if (!element || !window.appEditors || !element.id || !window.appEditors[element.id]) {
      return;
    }

    const editorWrapper = element.closest('.ck-editor');
    if (!editorWrapper) {
      return;
    }

    editorWrapper.classList.toggle('ck-invalid', !isValid);
    editorWrapper.classList.toggle('ck-valid', Boolean(isValid));
  };

  $.validator.setDefaults({
    ignore: [],
    onkeyup: function (element) {
      if (element.name && CKEDITOR_FIELDS.includes(element.name)) {
        syncEditorValue(element.name);
      }
      $(element).valid();
    },
    onfocusout: function (element) {
      if (element.name && CKEDITOR_FIELDS.includes(element.name)) {
        syncEditorValue(element.name);
      }
      $(element).valid();
    },
    onclick: function (element) {
      $(element).valid();
    },
    errorElement: 'div',
    errorClass: 'invalid-feedback validation-error',
    validClass: 'valid-feedback validation-success',
    highlight: function (element) {
      $(element).addClass('is-invalid').removeClass('is-valid');
      toggleEditorState(element, false);
    },
    unhighlight: function (element) {
      $(element).removeClass('is-invalid').addClass('is-valid');
      toggleEditorState(element, true);
    },
    errorPlacement: function (error, element) {
      if (element.hasClass('editor')) {
        const editor = element.next('.ck-editor');
        if (editor.length) {
          error.insertAfter(editor);
          return;
        }
      }

      if (element.closest('.input-group').length) {
        error.insertAfter(element.closest('.input-group'));
        return;
      }

      error.insertAfter(element);
    }
  });

  $.validator.addMethod(
    'strongPassword',
    function (value, element) {
      if (this.optional(element)) {
        return true;
      }

      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
    },
    'Use at least 8 characters with uppercase, lowercase, and a number.'
  );

  $.validator.addMethod(
    'phoneIntl',
    function (value, element) {
      if (this.optional(element)) {
        return true;
      }

      const digitsOnly = value.replace(/\D/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    },
    'Enter a valid phone number with 10 to 15 digits.'
  );

  $.validator.addMethod(
    'richTextRequired',
    function (value, element) {
      syncEditorValue(element.name);
      return stripHtml($(element).val()).length > 0;
    },
    'This field is required.'
  );

  $.validator.addMethod(
    'richTextMinLength',
    function (value, element, param) {
      syncEditorValue(element.name);
      return stripHtml($(element).val()).length >= param;
    },
    'Please enter more text.'
  );

  $.validator.addMethod(
    'richTextMaxLength',
    function (value, element, param) {
      syncEditorValue(element.name);
      return stripHtml($(element).val()).length <= param;
    },
    'Please shorten this text.'
  );

  const attachEditorListeners = () => {
    const bind = () => {
      if (!window.appEditors) {
        return;
      }

      Object.entries(window.appEditors).forEach(([id, editor]) => {
        if (editor.__validationBound) {
          return;
        }

        editor.model.document.on('change:data', () => {
          const textarea = document.getElementById(id);
          if (!textarea) {
            return;
          }

          textarea.value = editor.getData();
          $(textarea).valid();
        });

        editor.__validationBound = true;
      });
    };

    bind();
    setTimeout(bind, 500);
    setTimeout(bind, 1200);
  };

  const applyValidation = (selector, config) => {
    const $form = $(selector);
    if (!$form.length) {
      return;
    }

    $form.validate({
      ...config,
      submitHandler: function (form) {
        CKEDITOR_FIELDS.forEach(syncEditorValue);
        form.submit();
      }
    });
  };

  $(function () {
    applyValidation('#login-form', {
      rules: {
        email: {
          required: true,
          email: true
        },
        password: {
          required: true,
          minlength: 6,
          maxlength: 128
        }
      },
      messages: {
        email: {
          required: 'Please enter your email address.',
          email: 'Enter a valid email address.'
        },
        password: {
          required: 'Please enter your password.',
          minlength: 'Password must be at least 6 characters.'
        }
      }
    });

    applyValidation('#register-form', {
      rules: {
        name: {
          required: true,
          minlength: 2,
          maxlength: 60
        },
        email: {
          required: true,
          email: true
        },
        password: {
          required: true,
          strongPassword: true,
          maxlength: 128
        },
        confirm_password: {
          required: true,
          equalTo: '#password'
        }
      },
      messages: {
        name: {
          required: 'Please enter your full name.',
          minlength: 'Name must be at least 2 characters.',
          maxlength: 'Name cannot exceed 60 characters.'
        },
        email: {
          required: 'Please enter your email address.',
          email: 'Enter a valid email address.'
        },
        password: {
          required: 'Please create a password.'
        },
        confirm_password: {
          required: 'Please confirm your password.',
          equalTo: 'Passwords do not match.'
        }
      }
    });

    applyValidation('#forgot-password-form', {
      rules: {
        email: {
          required: true,
          email: true
        }
      },
      messages: {
        email: {
          required: 'Please enter your email address.',
          email: 'Enter a valid email address.'
        }
      }
    });

    applyValidation('#reset-password-form', {
      rules: {
        password: {
          required: true,
          strongPassword: true,
          maxlength: 128
        },
        confirm_password: {
          required: true,
          equalTo: '#password'
        }
      },
      messages: {
        password: {
          required: 'Please enter a new password.'
        },
        confirm_password: {
          required: 'Please confirm your new password.',
          equalTo: 'Passwords do not match.'
        }
      }
    });

    applyValidation('#note-form', {
      rules: {
        title: {
          required: true,
          minlength: 3,
          maxlength: 120
        },
        priority: {
          required: true
        },
        description: {
          richTextRequired: true,
          richTextMinLength: 10,
          richTextMaxLength: 5000
        }
      },
      messages: {
        title: {
          required: 'Please enter a note title.',
          minlength: 'Title must be at least 3 characters.',
          maxlength: 'Title cannot exceed 120 characters.'
        },
        priority: {
          required: 'Please choose a priority level.'
        },
        description: {
          richTextRequired: 'Please enter the note description.',
          richTextMinLength: 'Description should be at least 10 characters.',
          richTextMaxLength: 'Description cannot exceed 5000 characters.'
        }
      }
    });

    applyValidation('#daily-note-form', {
      rules: {
        date: {
          required: true,
          date: true
        },
        project_name: {
          required: true,
          minlength: 2,
          maxlength: 120
        },
        task_title: {
          required: true,
          minlength: 3,
          maxlength: 150
        },
        status: {
          required: true
        },
        day_start_description: {
          richTextRequired: true,
          richTextMinLength: 10,
          richTextMaxLength: 4000
        },
        day_end_description: {
          richTextMaxLength: 4000
        },
        remarks: {
          maxlength: 500
        }
      },
      messages: {
        date: {
          required: 'Please choose a date.'
        },
        project_name: {
          required: 'Please enter the project name.',
          minlength: 'Project name must be at least 2 characters.',
          maxlength: 'Project name cannot exceed 120 characters.'
        },
        task_title: {
          required: 'Please enter the task title.',
          minlength: 'Task title must be at least 3 characters.',
          maxlength: 'Task title cannot exceed 150 characters.'
        },
        status: {
          required: 'Please select a status.'
        },
        day_start_description: {
          richTextRequired: 'Please describe the day start or planned work.',
          richTextMinLength: 'Day start description should be at least 10 characters.',
          richTextMaxLength: 'Day start description cannot exceed 4000 characters.'
        },
        day_end_description: {
          richTextMaxLength: 'Day end description cannot exceed 4000 characters.'
        },
        remarks: {
          maxlength: 'Remarks cannot exceed 500 characters.'
        }
      }
    });

    applyValidation('#profile-form', {
      rules: {
        name: {
          required: true,
          minlength: 2,
          maxlength: 60
        },
        phoneNumber: {
          phoneIntl: true
        },
        bio: {
          maxlength: 300
        }
      },
      messages: {
        name: {
          required: 'Please enter your name.',
          minlength: 'Name must be at least 2 characters.',
          maxlength: 'Name cannot exceed 60 characters.'
        },
        phoneNumber: {
          phoneIntl: 'Phone number should contain 10 to 15 digits.'
        },
        bio: {
          maxlength: 'Bio cannot exceed 300 characters.'
        }
      }
    });

    applyValidation('#password-form', {
      rules: {
        currentPassword: {
          required: true,
          minlength: 6,
          maxlength: 128
        },
        newPassword: {
          required: true,
          strongPassword: true,
          maxlength: 128
        }
      },
      messages: {
        currentPassword: {
          required: 'Please enter your current password.',
          minlength: 'Current password must be at least 6 characters.'
        },
        newPassword: {
          required: 'Please enter a new password.'
        }
      }
    });

    applyValidation('#task-form', {
      rules: {
        title: {
          required: true,
          minlength: 3,
          maxlength: 150
        },
        priority: {
          required: true
        },
        status: {
          required: true
        },
        description: {
          richTextRequired: true,
          richTextMinLength: 10,
          richTextMaxLength: 5000
        }
      },
      messages: {
        title: {
          required: 'Please enter the task title.',
          minlength: 'Task title must be at least 3 characters.',
          maxlength: 'Task title cannot exceed 150 characters.'
        },
        priority: {
          required: 'Please choose a task priority.'
        },
        status: {
          required: 'Please choose a task status.'
        },
        description: {
          richTextRequired: 'Please describe the task clearly.',
          richTextMinLength: 'Task description should be at least 10 characters.',
          richTextMaxLength: 'Task description cannot exceed 5000 characters.'
        }
      }
    });

    attachEditorListeners();
  });
})(window.jQuery);
