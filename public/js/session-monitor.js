(function () {
  const FORCE_LOGOUT_STORAGE_KEY = 'forced_logout_message';
  const SESSION_EXPIRED_REASON = 'session_expired';

  const showMessage = async (message) => {
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        icon: 'warning',
        title: 'Session ended',
        text: message,
        confirmButtonText: 'Go to login'
      });
      return;
    }

    window.alert(message);
  };

  const redirectToLogin = (message, redirectUrl, shouldPersistMessage = true) => {
    if (message && shouldPersistMessage) {
      window.sessionStorage.setItem(FORCE_LOGOUT_STORAGE_KEY, message);
    }

    window.location.href = redirectUrl || '/auth/login?reason=session_expired';
  };

  const bootstrapForcedLogoutUi = async () => {
    const params = new URLSearchParams(window.location.search);
    const storedMessage = window.sessionStorage.getItem(FORCE_LOGOUT_STORAGE_KEY);
    const shouldShowQueryMessage =
      params.get('reason') === SESSION_EXPIRED_REASON && !window.currentSession;

    if (!storedMessage && !shouldShowQueryMessage) {
      return;
    }

    const message =
      storedMessage || 'Session expired due to login from another device.';

    window.sessionStorage.removeItem(FORCE_LOGOUT_STORAGE_KEY);
    await showMessage(message);
  };

  const wrapFetch = () => {
    if (!window.fetch || window.__sessionAwareFetch) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.__sessionAwareFetch = true;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status !== 401) {
        return response;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return response;
      }

      try {
        const payload = await response.clone().json();
        if (payload && payload.code === 'SESSION_EXPIRED') {
          redirectToLogin(payload.message, payload.redirectUrl);
        }
      } catch (error) {
        console.error('Unable to parse session expiry response:', error);
      }

      return response;
    };
  };

  const connectSessionSocket = () => {
    if (!window.currentSession || typeof io === 'undefined') {
      return;
    }

    const socket = io({
      reconnection: true
    });

    window.appSocket = socket;

    socket.on('force_logout', async (payload = {}) => {
      const message = payload.message || 'Session expired due to login from another device.';

      try {
        socket.disconnect();
      } catch (error) {
        console.error('Socket disconnect error:', error);
      }

      await showMessage(message);
      redirectToLogin(
        message,
        payload.redirectUrl || window.currentSession.sessionExpiredRedirect,
        false
      );
    });

    socket.on('connect_error', (error) => {
      if (error && error.message === 'SESSION_EXPIRED') {
        redirectToLogin(
          'Session expired due to login from another device.',
          window.currentSession.sessionExpiredRedirect
        );
      }
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    wrapFetch();
    bootstrapForcedLogoutUi().catch((error) => {
      console.error('Forced logout UI error:', error);
    });
    connectSessionSocket();
  });
})();
