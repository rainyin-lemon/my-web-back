// 🔥 单文件聊天室：1个JS = 前端 + 后端 + WebSocket
let connections = [];
let messageHistory = [];
const MAX_HISTORY = 20;

export default {
  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");

    // —————————— 1. 返回聊天界面（前端） ——————————
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
body{max-width:700px;margin:30px auto;padding:0 15px;background:#f7f9fc}
.box{background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px #00000010}
.head{padding:18px;background:#4e79f7;color:white;display:flex;justify-content:space-between}
.online{background:#ffffff33;padding:4px 10px;border-radius:12px;font-size:14px}
.msgArea{height:500px;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.msg{padding:10px 14px;background:#f1f3f5;border-radius:12px;max-width:82%}
.me{background:#d7e4ff;margin-left:auto}
.name{font-size:12px;color:#666;margin-bottom:4px}
.ip{font-size:11px;color:#999;background:#eee;padding:1px 6px;border-radius:4px}
.text{line-height:1.5}
.time{font-size:11px;color:#999;margin-top:4px;text-align:right}
.inputArea{display:flex;padding:15px;gap:10px;border-top:1px solid #eee}
#username{width:120px;padding:10px;border:1px solid #ddd;border-radius:8px}
#input{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px}
button{padding:10px 16px;background:#4e79f7;color:white;border:none;border-radius:8px}
button:disabled{background:#ccc}
</style>
</head>
<body>
<div class="box">
  <div class="head">
    <h3>🌍 全局聊天室</h3>
    <div id="online" class="online">连接中...</div>
  </div>
  <div id="msgArea" class="msgArea"></div>
  <div class="inputArea">
    <input id="username" readonly>
    <input id="input" placeholder="输入消息...">
    <button id="sendBtn" disabled>发送</button>
  </div>
</div>

<script>
const ws = new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host);
const msgArea = document.getElementById("msgArea");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const online = document.getElementById("online");
const username = document.getElementById("username");

// 随机用户名
const adj=["快乐","勇敢","安静","闪亮","温柔","热心","酷酷","憨憨","可爱","迷糊"];
const ani=["猫咪","狗狗","兔子","狐狸","熊猫","老虎","小熊","小鹿","松鼠","海豚"];
const myName=adj[Math.random()*adj.length|0] + ani[Math.random()*ani.length|0] + (Math.random()*100|0);
username.value=myName;

ws.onopen=()=>{sendBtn.disabled=false;online.textContent="✅ 已连接"};
ws.onclose=()=>{sendBtn.disabled=true;online.textContent="🔄重连中...";setTimeout(()=>location.reload(),2000)};
ws.onmessage=(e)=>{
  const d=JSON.parse(e.data);
  if(d.type==="history")d.list.forEach(addMsg);
  if(d.type==="msg")addMsg(d);
  if(d.type==="online")online.textContent=\`在线：\${d.count}\`;
};
function addMsg(m){
  const div=document.createElement("div");
  div.className="msg "+(m.username===myName?"me":"");
  div.innerHTML=\`
  <div class="name">\${m.username} <span class="ip">\${m.ip}·\${m.country}</span></div>
  <div class="text">\${m.content}</div>
  <div class="time">\${m.time}</div>\`;
  msgArea.appendChild(div);
  msgArea.scrollTop=msgArea.scrollHeight;
}
function send(){if(!input.value.trim())return;ws.send(JSON.stringify({username:myName,content:input.value.trim()}));input.value="";}
input.onkeydown=(e)=>e.key==="Enter"&&send();
sendBtn.onclick=send;
</script>
</body>
</html>
      `, { headers: { "Content-Type": "text/html;charset=utf-8" } });
    }

    // —————————— 2. WebSocket 聊天后端 ——————————
    const ip = request.headers.get("cf-connecting-ip") || "未知IP";
    const country = request.headers.get("cf-ipcountry") || "未知";
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    connections.push(server);

    // 发送历史
    server.send(JSON.stringify({ type: "history", list: messageHistory }));
    broadcastOnline();

    // 接收消息
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

    // 断开清理
    const clean = () => {
      connections = connections.filter(ws => ws !== server);
      broadcastOnline();
    };
    server.addEventListener("close", clean);
    server.addEventListener("error", clean);

    return new Response(null, { status: 101, webSocket: client });
  }
};

// 广播
function broadcast(msg) {
  connections.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}
function broadcastOnline() {
  broadcast(JSON.stringify({ type: "online", count: connections.length }));
}
