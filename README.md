# Assistech

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `SMTP_USER` e `SMTP_PASS` com uma conta SMTP válida. No Gmail, use uma senha de app, não a senha normal da conta.
3. Confirme `DESTINATION_EMAIL=heltonmachado2017@gmail.com`.
4. Execute:

```bash
npm start
```

Abra `http://localhost:3000` no navegador.

O formulário envia os dados para `POST /api/contato`. A mensagem só será enviada de verdade depois que as credenciais SMTP forem configuradas no `.env`.
