const authForms = document.querySelectorAll('[data-auth-form]');

authForms.forEach((authForm) => {
  const authStatus = authForm.querySelector('.form-status');

  if (!authStatus) {
    return;
  }

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (authForm.dataset.authForm === 'login') {
      localStorage.removeItem('assistechToken');
      localStorage.removeItem('assistechUser');
    }

    const submitButton = authForm.querySelector('button[type="submit"]');
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());

    authStatus.hidden = false;
    authStatus.textContent = 'Processando...';
    authStatus.style.color = '';
    submitButton.disabled = true;

    try {
      const response = await fetch(authForm.action, {
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const responseText = await response.text();
      let result = {};

      try {
        result = responseText.trim() ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('A API não está disponível nesta página. Acesse pelo servidor com "npm start" e use http://localhost:3000.');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível concluir a operação.');
      }

      authStatus.textContent = result.message;
      authStatus.style.color = '#15803d';

      if (authForm.dataset.authForm === 'login') {
        localStorage.setItem('assistechToken', result.token);
        localStorage.setItem('assistechUser', JSON.stringify(result.user));
        const destination = result.user.perfil === 'admin'
          ? 'admin.html'
          : result.user.perfil === 'tecnico' ? 'tecnico.html' : 'cliente.html';
        window.setTimeout(() => { window.location.href = destination; }, 500);
      }

      if (authForm.dataset.authForm === 'register') {
        authForm.reset();
        window.setTimeout(() => { window.location.href = 'login.html'; }, 900);
      }
    } catch (error) {
      authStatus.textContent = error instanceof TypeError
        ? 'Não foi possível conectar ao servidor. Execute "npm start".'
        : error.message;
      authStatus.style.color = '#c2410c';
    } finally {
      submitButton.disabled = false;
    }
  });
});
