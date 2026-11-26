try {
  const { startWorkspace } = await import('./auth-client.js');
  await startWorkspace();
  await import('./app.js');
} catch (error) {
  const main = document.querySelector('#main');
  main.textContent = error.message || 'Không mở được không gian nghiên cứu.';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Thử lại';
  button.onclick = () => location.reload();
  main.append(document.createElement('br'), button);
}
