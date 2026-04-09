// 全局状态
let connections = [];
let messageHistory = [];
const MAX_HISTORY = 20;

export default {
	async fetch(request) {
		const upgrade = request.headers.get("Upgrade");
		if (upgrade !== "websocket") {
			return new Response("WebSocket Server", {
				status: 200
			});
		}

		// 获取用户IP
		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		const country = request.headers.get("cf-ipcountry") || "unknown";

		// 创建WebSocket配对
		const [client, server] = Object.values(new WebSocketPair());
		server.accept();

		// 用户信息
		const user = {
			id: Math.random().toString(36).slice(2),
			ws: server,
			ip,
			country
		};
		connections.push(user);

		// 发送历史消息
		server.send(JSON.stringify({
			type: "history",
			history: messageHistory
		}));

		// 广播在线人数
		broadcastUserCount();

		// 监听消息
		server.addEventListener("message", (evt) => {
			try {
				const data = JSON.parse(evt.data);
				if (!data.content || data.content.length > 500) return;

				const msg = {
					username: data.username || "匿名用户",
					content: data.content.substring(0, 500),
					ip: user.ip,
					country: user.country,
					time: new Date().toLocaleTimeString()
				};

				// 保存历史
				messageHistory.push(msg);
				if (messageHistory.length > MAX_HISTORY) {
					messageHistory.shift();
				}

				// 广播消息
				broadcast(JSON.stringify({
					type: "message",
					...msg
				}));
			} catch (e) {}
		});

		// 断开清理
		function cleanUp() {
			connections = connections.filter(u => u.ws !== server);
			broadcastUserCount();
		}
		server.addEventListener("close", cleanUp);
		server.addEventListener("error", cleanUp);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}
};

// 广播消息给所有人
function broadcast(msg) {
	connections.forEach(user => {
		if (user.ws.readyState === 1) user.ws.send(msg);
	});
}

// 广播在线人数
function broadcastUserCount() {
	broadcast(JSON.stringify({
		type: "online",
		count: connections.length
	}));
}