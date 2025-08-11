<script>
document.getElementById('webhookBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = "Enviando...";

    try {
        const resp = await fetch("https://n8n.arthuraaferreira.com.br/webhook-test/43a7c5b8-1c04-4389-a9aa-46b8c4611d4c", {
            method: "POST", // POST para enviar dados
            mode: "cors",   // habilita CORS
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                msg: "Olá do site!",
                hora: new Date().toISOString()
            })
        });

        if (resp.ok) {
            statusEl.textContent = "Webhook acionado com sucesso!";
            statusEl.style.color = "green";
        } else {
            statusEl.textContent = `Erro ao acionar webhook: ${resp.status}`;
            statusEl.style.color = "red";
        }
    } catch (err) {
        statusEl.textContent = "Falha de conexão.";
        statusEl.style.color = "red";
    }
});
</script>
