export function createApi({ getToken, setToken, requestToken, fetcher = fetch }) {
  return async function api(path, method = 'GET', body) {
    const send = async () => {
      const accessToken = await getToken();
      return fetcher(`/api${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
    };
    let response;
    try {
      response = await send();
    } catch {
      throw new Error('Không kết nối được máy chủ. Kiểm tra server rồi thử lại.');
    }
    if (response.status === 401) {
      const token = await requestToken();
      if (token) {
        setToken(token);
        response = await send();
      }
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Phản hồi máy chủ không hợp lệ. Hãy tải lại trang.');
    }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };
}
