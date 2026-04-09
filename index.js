export default {
  async fetch(request) {
    return new Response(`
<!DOCTYPE html>
<h1>✅ 部署成功！聊天室加载中...</h1>
<p>如果你看到这句话，说明 Worker 正常运行！</p>
`, {
      headers: { "Content-Type": "text/html;charset=utf-8" }
    });
  }
};
