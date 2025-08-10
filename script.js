document.getElementById('webhookBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = "Enviando...";

    try {
        const resp = await fetch("https://n8n.arthuraaferreira.com.br/webhook-test/43a7c5b8-1c04-4389-a9aa-46b8c4611d4c", {
            method: "GET", // ou "POST" se seu webhook precisar
            mode: "cors" // habilita CORS
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
