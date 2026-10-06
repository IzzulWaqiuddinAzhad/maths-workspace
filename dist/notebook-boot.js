// A failed module must show an actionable error instead of an endless spinner.
try {
  await import('./notebook.js?v=10');
} catch (error) {
  console.error('Notebook startup failed', error);
  const message=document.getElementById('pageLoading');
  message.hidden=false;message.textContent='The module could not start. Please reload this page.';
  const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();message.append(document.createElement('br'),retry);
}
