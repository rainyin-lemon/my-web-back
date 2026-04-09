// 全局状态
let connections = [];
let messageHistory = [];
const MAX_HISTORY = 20;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");

    // ———————————————————— 前端页面（内置） ————————————————————
    if (!upgrade) {
      return new Response(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>全局聊天室</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,sans-serif}
body{max-width:800px;margin:20px auto;padding:0 15px;background:#f2f5f7}
.chat{background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.header{padding:16px 20px;background:#4e79f7;color:white;display:flex;justify-content:space-between}
.online{background:rgba(255,255,255,.2);padding:4px 10px;border-radius:12px;font-size:14px}
.msgBox{height:500px;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.msg{padding:10px 14px;background:#f2f5f7;border-radius:12px;max-width:80%}
.msg.self{background:#d0e0ff;margin-left:auto}
.name{font-size:12px;color:#666;margin-bottom:4px}
.ip{font-size:11px;color:#999;background:#eee;padding:1px 6px;border-radius:4px}
.content{line-height:1.4}
.time{font-size:11px;color:#999;margin-top:4px;text-align:right}
.inputBar{display:flex;padding:15px 20px;gap:10px;border-top:1px solid #eee}
#user{width:120px;padding:10px;border:1px solid #ddd;border-radius:8px}
#text{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px}
button{padding:10px 18px;background:#4e79f7;color:white;border:none;border-radius:8px}
button:disabled{background:#ccc}
</style>
</head>
<body>
<div class="chat">
  <div class="header"><h3>🌍 全局聊天室</h3><div id="online">连接中...</div></div>
  <div class="msgBox" id="msgBox"></div>
  <div class="inputBar">
    <input id="user" readonly>
    <input id="text" placeholder="输入消息...">
    <button id="sendBtn" disabled>发送</button>
  </div>
</div>

<script>
const ws = new WebSocket((location.protocol==="https:"?"wss:":"ws:")+"//"+location.host);
const user = document.getElementById("user");
const text = document.getElementById("text");
const sendBtn = document.getElementById("sendBtn");
const msgBox = document.getElementById("msgBox");
const online = document.getElementById("online");

// 随机用户名
const adj=["快乐","勇敢","安静","闪亮","温柔","热心","酷酷","憨憨","可爱","迷糊"];
const ani=["猫咪","狗狗","兔子","狐狸","熊猫","老虎","小熊","小鹿","松鼠","海豚"];
const myName=adj[Math.random()*adj.length|0]+ani[Math.random()*ani.length|0]+(Math.random()*100|0);
user.value=myName;

ws.onopen=()=>{sendBtn.disabled=false;online.textContent="在线：已连接"};
ws.onclose=()=>{sendBtn.disabled=true;online.textContent="重连中...";setTimeout(()=>location.reload(),2000)};
ws.onmessage=(e)=>{
  const d=JSON.parse(e.data);
  if(d.type==="history")d.history.forEach(render);
  if(d.type==="msg")render(d);
  if(d.type==="online")online.textContent=\`在线：\${d.count}\`;
};
function render(m){
  const div=document.createElement("div");
  div.className=\`msg \${m.username===myName?"self":""}\`;
  div.innerHTML=\`
  <div class="name">\${m.username} <span class="ip">\${m.ip} · \${m.country}</span></div>
  <div class="content">\${m.content}</div>
  <div class="time">\${m.time}</div>\`;
  msgBox.appendChild(div);
  msgBox.scrollTop=msgBox.scrollHeight;
}
function send(){if(!text.value.trim())return;ws.send(JSON.stringify({username:myName,content:text.value.trim()}));text.value="";}
text.onkeydown=(e)=>e.key==="Enter"&&send();
</script>
</body>
</html>
      `, { headers: { "Content-Type": "text/html;charset=utf-8" } });
    }

    // ———————————————————— WebSocket 后端 ————————————————————
    const ip = request.headers.get("cf-connecting-ip") || "未知IP";
    const country = request.headers.get("cf-ipcountry") || "未知";
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    connections.push(server);
    broadcastOnline();

    // 发送历史
    server.send(JSON.stringify({ type: "history", history: messageHistory }));

    // 消息
    server.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        const msg = {
          username: data.username || "匿名",
          content: data.content.substring(0, 300),
          ip, country,
          time: new Date().toLocaleTimeString()
        };
        messageHistory.push(msg);
        if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
        broadcast(JSON.stringify({ type: "msg", ...msg }));
      } catch (_) {}
    });

    // 断开
    server.addEventListener("close", () => {
      connections = connections.filter(s => s !== server);
      broadcastOnline();
    });
    server.addEventListener("error", () => {
      connections = connections.filter(s => s !== server);
      broadcastOnline();
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};

// 广播
function broadcast(msg) {
  connections.forEach(s => {
    if (s.readyState === 1) s.send(msg);
  });
}

function broadcastOnline() {
  broadcast(JSON.stringify({ type: "online", count: connections.length }));
}
