const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu-principal');
const menuLabel = document.querySelector('.menu-label');

if (menuButton && menu && menuLabel) {
	const closeMenu = () => {
		menu.classList.remove('is-open');
		menuButton.setAttribute('aria-expanded', 'false');
		menuLabel.textContent = 'Menu';
	};

	menuButton.addEventListener('click', () => {
		const isOpen = menu.classList.toggle('is-open');
		menuButton.setAttribute('aria-expanded', String(isOpen));
		menuLabel.textContent = 'Menu';
	});

	menu.querySelectorAll('a').forEach((link) => {
		link.addEventListener('click', closeMenu);
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeMenu();
			menuButton.focus();
		}
	});
}

const contactForm = document.querySelector('#form-contato');
const formStatus = document.querySelector('#form-status');

if (contactForm && formStatus) {
	contactForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(contactForm);
		const submitButton = contactForm.querySelector('button[type="submit"]');

		formStatus.hidden = false;
		formStatus.textContent = 'Enviando mensagem...';
		submitButton.disabled = true;

		try {
			const response = await fetch('/api/contato', {
				body: JSON.stringify({
					nome: formData.get('nome'),
					email: formData.get('email'),
					mensagem: formData.get('mensagem'),
				}),
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST',
			});
			const responseText = await response.text();
			let result = {};

			if (responseText.trim()) {
				try {
					result = JSON.parse(responseText);
				} catch {
					throw new Error('O servidor retornou uma resposta inválida.');
				}
			}

			if (!response.ok) {
				throw new Error(result.error || 'Não foi possível enviar a mensagem.');
			}

			formStatus.textContent = result.message || 'Mensagem enviada com sucesso!';
			contactForm.reset();
		} catch (error) {
			formStatus.textContent = error instanceof TypeError
				? 'A API não está disponível. Execute "npm start" e acesse http://localhost:3000.'
				: error.message || 'Não foi possível enviar a mensagem agora.';
		} finally {
			submitButton.disabled = false;
		}
	});
}
