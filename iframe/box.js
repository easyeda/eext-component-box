(function () {
	var BOX_ROWS = 5;
	var BOX_COLS = 7;
	var DEVICES_KEY = 'myComponentLibDevices';
	var BOX_KEY = 'myComponentLibBox';
	var AUTO_CONNECT_KEY = 'boxAutoConnect';
	var CONN_TYPE_KEY = 'boxConnectionType';
	var statusEl = document.getElementById('status');
	var boxGrid = document.getElementById('box-grid');
	var pickerOverlay = document.getElementById('picker-overlay');
	var pickerClose = document.getElementById('picker-close');
	var pickerSearch = document.getElementById('picker-search');
	var pickerList = document.getElementById('picker-list');
	var pickerClear = document.getElementById('picker-clear');
	var oledName = document.getElementById('oled-name');
	var oledQty = document.getElementById('oled-qty');
	var oledId = document.getElementById('oled-id');
	var dpadUp = document.getElementById('dpad-up');
	var dpadDown = document.getElementById('dpad-down');
	var dpadLeft = document.getElementById('dpad-left');
	var dpadRight = document.getElementById('dpad-right');
	var dpadCenter = document.getElementById('dpad-center');
	var autoConnectToggle = document.getElementById('auto-connect');

	var devices = [];
	var boxMap = {};
	var currentCell = null;
	var cursorRow = 0;
	var cursorCol = 0;
	var autoConnect = false;
	var hardwareMode = 'normal';
	var currentSettings = null;
	var settingsCursor = 0;
	var settingsEditing = false;
	var SYNCED_QTY_KEY = 'myComponentLibBoxSyncedQty';
	var SYNCED_TS_KEY = 'myComponentLibBoxSyncedTs';
	var syncedBoxQty = {};
	var syncedBoxTs = {};
	var syncActive = false;

	var SETTINGS_NAMES = ['灯光颜色','灯光亮度','空闲灯效','空闲时间','光标灯效','屏幕对比度','熄屏倒计时','蓝牙开关','语言切换','重新配对','退出设置'];
	var SETTINGS_NAMES_EN = ['LED Color','Brightness','Idle Effect','Idle Time','Cursor Effect','Contrast','Sleep Timer','Bluetooth','Language','Re-pair','Exit Settings'];
	var COLOR_NAMES = ['红','绿','蓝','黄','紫','白','橙'];
	var COLOR_NAMES_EN = ['Red','Green','Blue','Yellow','Purple','White','Orange'];
	var IDLE_FX_NAMES = ['关闭','彩虹','波涛','呼吸','渐变'];
	var IDLE_FX_NAMES_EN = ['Off','Rainbow','Wave','Breathing','Gradient'];
	var IDLE_TM_OPTS = [3,5,10,15,30,60];
	var CURSOR_FX_NAMES = ['静态','闪灁','呼吸','渐变'];
	var CURSOR_FX_NAMES_EN = ['Static','Blink','Breathing','Gradient'];
	var TIMEOUT_OPTS = [0,1,2,5,10,15,30];
	var lang = 0; // 0=Chinese, 1=English

	function L(zh, en) { return lang === 1 ? en : zh; }

	function setStatus(text, type) {
		statusEl.textContent = text;
		statusEl.className = 'status ' + (type || '');
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	function loadDevices() {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig(DEVICES_KEY);
			if (raw) devices = JSON.parse(raw);
		} catch (e) {}
	}

	function loadBoxMap() {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig(BOX_KEY);
			if (raw) boxMap = JSON.parse(raw);
		} catch (e) {}
	}

	async function saveBoxMap() {
		try {
			await eda.sys_Storage.setExtensionUserConfig(BOX_KEY, JSON.stringify(boxMap));
		} catch (e) {}
	}

	function loadSyncedBoxQty() {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig(SYNCED_QTY_KEY);
			if (raw) syncedBoxQty = JSON.parse(raw);
		} catch (e) {}
	}

	async function saveSyncedBoxQty() {
		try {
			await eda.sys_Storage.setExtensionUserConfig(SYNCED_QTY_KEY, JSON.stringify(syncedBoxQty));
		} catch (e) {}
	}

	function loadSyncedBoxTs() {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig(SYNCED_TS_KEY);
			if (raw) syncedBoxTs = JSON.parse(raw);
		} catch (e) {}
	}

	async function saveSyncedBoxTs() {
		try {
			await eda.sys_Storage.setExtensionUserConfig(SYNCED_TS_KEY, JSON.stringify(syncedBoxTs));
		} catch (e) {}
	}

	function loadAutoConnect() {
		try {
			autoConnect = eda.sys_Storage.getExtensionUserConfig(AUTO_CONNECT_KEY) === 'true';
		} catch (e) {}
		autoConnectToggle.checked = autoConnect;
	}

	async function saveAutoConnect() {
		try {
			await eda.sys_Storage.setExtensionUserConfig(AUTO_CONNECT_KEY, autoConnect ? 'true' : 'false');
		} catch (e) {}
	}

	// ===== Auto-connect toggle =====

	autoConnectToggle.addEventListener('change', async function () {
		autoConnect = autoConnectToggle.checked;
		await saveAutoConnect();
		if (!autoConnect) {
			try { await eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, ''); } catch (e) {}
		} else if (connected) {
			try { await eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, connectionType); } catch (e) {}
		}
	});

	// ===== Connection state helpers =====

	function onConnected() {
		btnSync.style.display = '';
		dpadCenter.innerHTML = '&#9881;';
		if (oledConnBadge) {
			oledConnBadge.className = 'oled-conn-badge conn-' + (connectionType === 'ble' ? 'ble' : 'usb');
			oledConnBadge.style.display = '';
		}
	}

	function onDisconnected() {
		hardwareMode = 'normal';
		dpadCenter.innerHTML = '&#9679;';
		if (oledConnBadge) {
			oledConnBadge.style.display = 'none';
			oledConnBadge.className = 'oled-conn-badge';
		}
		oledDisplay.classList.remove('oled-settings-mode');
	}

	var oledDisplay = document.getElementById('oled-display');
	var oledConnBadge = document.getElementById('oled-conn-badge');

	// ===== OLED & Cursor =====

	function updateOled() {
		var key = cursorRow + '-' + cursorCol;
		var lcscId = boxMap[key];
		if (lcscId) {
			var dev = devices.find(function (d) { return d.lcscId === lcscId; });
			oledName.textContent = dev ? (dev.name || '-') : '-';
			oledQty.textContent = L('数量: ', 'Qty: ') + (dev ? dev.quantity : 0);
			oledId.textContent = lcscId;
		} else {
			oledName.textContent = L('(空)', '(Empty)');
			oledQty.textContent = L('位置: ', 'Pos: ') + (cursorCol + 1) + '-' + (cursorRow + 1);
			oledId.textContent = '';
		}
	}

	function updateCursorHighlight(skipOled) {
		var cells = boxGrid.querySelectorAll('.box-cell');
		cells.forEach(function (cell) { cell.classList.remove('active-cell'); });
		var idx = cursorRow * BOX_COLS + cursorCol;
		if (cells[idx]) cells[idx].classList.add('active-cell');
		if (!skipOled) updateOled();
	}

		function renderSettingsOled() {
		var s = currentSettings || {};
		var names = lang === 1 ? SETTINGS_NAMES_EN : SETTINGS_NAMES;
		var colors = lang === 1 ? COLOR_NAMES_EN : COLOR_NAMES;
		var idleFx = lang === 1 ? IDLE_FX_NAMES_EN : IDLE_FX_NAMES;
		var cursorFx = lang === 1 ? CURSOR_FX_NAMES_EN : CURSOR_FX_NAMES;
		if (settingsEditing) {
			oledName.textContent = names[settingsCursor];
			switch (settingsCursor) {
				case 0: oledQty.textContent = L('当前: ', 'Current: ') + (colors[s.colorIdx] || '-'); break;
				case 1: oledQty.textContent = L('亮度: ', 'Brightness: ') + ((s.brightIdx || 5) * 10) + '%'; break;
				case 2: oledQty.textContent = L('当前: ', 'Current: ') + (idleFx[s.idleEffect] || '-'); break;
				case 3: oledQty.textContent = IDLE_TM_OPTS[s.idleTimeoutIdx || 0] + L('秒', 's'); break;
				case 4: oledQty.textContent = L('当前: ', 'Current: ') + (cursorFx[s.cursorEffect] || '-'); break;
				case 5: oledQty.textContent = L('对比度: ', 'Contrast: ') + (s.contrast || 127); break;
				case 6:
					var ti = s.timeoutIdx || 0;
					oledQty.textContent = ti === 0 ? L('永不熄屏', 'Always On') : TIMEOUT_OPTS[ti] + L('分钟', 'min');
					break;
				case 7: oledQty.textContent = L('蓝牙: ', 'Bluetooth: ') + (s.bleOn ? L('开启', 'On') : L('关闭', 'Off')); break;
				case 8: oledQty.textContent = L('当前: ', 'Current: ') + (s.lang === 1 ? 'English' : '中文'); break;
			}
			oledId.textContent = L('上下调整 中键确认', 'Up/Down  OK');
		} else {
			var start = Math.max(0, Math.min(settingsCursor - 1, names.length - 3));
			var lines = [];
			for (var i = 0; i < 3 && start + i < names.length; i++) {
				lines.push((start + i === settingsCursor ? '> ' : '  ') + names[start + i]);
			}
			oledName.textContent = lines[0] || '';
			oledQty.textContent = lines[1] || '';
			oledId.textContent = lines[2] || '';
		}
	}


	// ===== Grid =====

	function renderBoxGrid() {
		boxGrid.innerHTML = '';
		for (var r = 0; r < BOX_ROWS; r++) {
			for (var c = 0; c < BOX_COLS; c++) {
				var key = r + '-' + c;
				var cell = document.createElement('div');
				cell.className = 'box-cell';
				cell.dataset.row = r;
				cell.dataset.col = c;

				var label = document.createElement('div');
				label.className = 'cell-label';
				label.textContent = (c + 1) + '-' + (r + 1);
				cell.appendChild(label);

				var lcscId = boxMap[key];
				if (lcscId) {
					cell.classList.add('occupied');
					var dev = devices.find(function (d) { return d.lcscId === lcscId; });
					var nameEl = document.createElement('div');
					nameEl.className = 'cell-name';
					nameEl.textContent = dev ? (dev.name || dev.lcscId) : lcscId;
					cell.appendChild(nameEl);
					var idEl = document.createElement('div');
					idEl.className = 'cell-id';
					idEl.textContent = lcscId;
					cell.appendChild(idEl);
				}

				cell.addEventListener('click', (function (row, col) {
					return function () {
						cursorRow = row;
						cursorCol = col;
						updateCursorHighlight();
						if (connected) sendJSON({ type: 'goto', row: row, col: col });
					};
				})(r, c));

				cell.addEventListener('dblclick', (function (row, col) {
					return function () {
						currentCell = { row: row, col: col };
						openPicker();
					};
				})(r, c));

				boxGrid.appendChild(cell);
			}
		}
	}

	// ===== Picker =====

	function openPicker() {
		loadDevices();
		pickerSearch.value = '';
		renderPickerList('');
		pickerOverlay.style.display = 'flex';
	}

	function renderPickerList(keyword) {
		var filtered = devices;
		if (keyword) {
			var kw = keyword.toLowerCase();
			filtered = devices.filter(function (d) {
				return (d.lcscId || '').toLowerCase().indexOf(kw) !== -1 ||
					(d.name || '').toLowerCase().indexOf(kw) !== -1 ||
					(d.description || '').toLowerCase().indexOf(kw) !== -1;
			});
		}
		if (filtered.length === 0) {
			pickerList.innerHTML = '<div style="padding:16px;text-align:center;color:#999;">' + t('no_matching_components') + '</div>';
			return;
		}
		pickerList.innerHTML = filtered.map(function (d) {
			return '<div class="picker-item" data-id="' + escapeHtml(d.lcscId) + '">' +
				'<span class="pi-name">' + escapeHtml(d.name || d.lcscId) + '</span>' +
				'<span class="pi-id">' + escapeHtml(d.lcscId) + '</span></div>';
		}).join('');
		pickerList.querySelectorAll('.picker-item').forEach(function (item) {
			item.addEventListener('click', async function () {
				var id = item.dataset.id;
				if (currentCell) {
					var key = currentCell.row + '-' + currentCell.col;
					boxMap[key] = id;
					await saveBoxMap();
					renderBoxGrid();
					syncCellToHardware(currentCell.row, currentCell.col);
				}
				pickerOverlay.style.display = 'none';
			});
		});
	}

	pickerSearch.addEventListener('input', function () {
		renderPickerList(pickerSearch.value.trim());
	});

	pickerClear.addEventListener('click', async function () {
		if (currentCell) {
			var key = currentCell.row + '-' + currentCell.col;
			delete boxMap[key];
			await saveBoxMap();
			renderBoxGrid();
			syncCellToHardware(currentCell.row, currentCell.col);
		}
		pickerOverlay.style.display = 'none';
	});

	pickerClose.addEventListener('click', function () { pickerOverlay.style.display = 'none'; });
	pickerOverlay.addEventListener('click', function (e) {
		if (e.target === pickerOverlay) pickerOverlay.style.display = 'none';
	});

	// ===== D-Pad =====

	function moveCursor(dr, dc) {
		if (hardwareMode === 'settings') {
			var names = lang === 1 ? SETTINGS_NAMES_EN : SETTINGS_NAMES;
			if (dr === -1 || dr === 1) {
				if (settingsEditing) {
					// value change - just send to hardware
					sendJSON({ type: 'snav', dir: dr === -1 ? 'up' : 'down' });
				} else {
					settingsCursor = (settingsCursor + dr + names.length) % names.length;
					renderSettingsOled();
					sendJSON({ type: 'snav', dir: dr === -1 ? 'up' : 'down' });
				}
			}
			return;
		}
		cursorRow = (cursorRow + dr + BOX_ROWS) % BOX_ROWS;
		cursorCol = (cursorCol + dc + BOX_COLS) % BOX_COLS;
		updateCursorHighlight();
		if (connected) sendJSON({ type: 'goto', row: cursorRow, col: cursorCol });
	}

	dpadUp.addEventListener('click', function () { moveCursor(-1, 0); });
	dpadDown.addEventListener('click', function () { moveCursor(1, 0); });
	dpadLeft.addEventListener('click', function () { moveCursor(0, -1); });
	dpadRight.addEventListener('click', function () { moveCursor(0, 1); });
	// Center button: short press = decrement qty, long press = settings
		var centerLongFired = false;
		var centerPressTimer = null;

		function handleCenterLong() {
			centerLongFired = true;
			if (connected) {
				if (hardwareMode === 'settings') {
					hardwareMode = 'normal';
					settingsEditing = false;
					oledDisplay.classList.remove('oled-settings-mode');
					updateOled();
					sendJSON({ type: 'stoggle' });
				} else {
					hardwareMode = 'settings';
					settingsCursor = 0;
					settingsEditing = false;
					oledDisplay.classList.add('oled-settings-mode');
					renderSettingsOled();
					sendJSON({ type: 'stoggle' });
				}
			}
		}

		function handleCenterShort() {
			if (centerLongFired) { centerLongFired = false; return; }
			var names = lang === 1 ? SETTINGS_NAMES_EN : SETTINGS_NAMES;
			if (connected) {
				if (hardwareMode === 'settings') {
					if (settingsCursor === names.length - 1) {
						hardwareMode = 'normal';
						settingsEditing = false;
						oledDisplay.classList.remove('oled-settings-mode');
						updateOled();
						sendJSON({ type: 'stoggle' });
					} else if (settingsCursor === 9) {
						// 重新配对: action, not editable
						sendJSON({ type: 'snav', dir: 'ok' });
					} else if (settingsEditing) {
						settingsEditing = false;
						renderSettingsOled();
						sendJSON({ type: 'snav', dir: 'ok' });
					} else {
						settingsEditing = true;
						renderSettingsOled();
						sendJSON({ type: 'snav', dir: 'ok' });
					}
				} else {
					decrementQty();
				}
			} else {
				decrementQty();
			}
		}

		function startCenterLong() {
			centerLongFired = false;
			centerPressTimer = setTimeout(handleCenterLong, 500);
		}

		function endCenterShort() {
			clearTimeout(centerPressTimer);
			handleCenterShort();
		}

		dpadCenter.addEventListener('mousedown', function (e) { startCenterLong(); });
		dpadCenter.addEventListener('click', function (e) { e.preventDefault(); endCenterShort(); });
		dpadCenter.addEventListener('mouseleave', function () { clearTimeout(centerPressTimer); });
		dpadCenter.addEventListener('touchstart', function (e) { e.preventDefault(); startCenterLong(); }, { passive: false });
		dpadCenter.addEventListener('touchend', function (e) { e.preventDefault(); endCenterShort(); }, { passive: false });

		function decrementQty() {
			var key = cursorRow + '-' + cursorCol;
			var lcscId = boxMap[key];
			if (lcscId) {
				var dev = devices.find(function (d) { return d.lcscId === lcscId; });
				if (dev && dev.quantity > 0) {
					dev.quantity--;
					dev.lastModified = Date.now();
					try { eda.sys_Storage.setExtensionUserConfig(DEVICES_KEY, JSON.stringify(devices)); } catch (e) {}
					updateOled();
					if (connected) sendJSON({ type: 'dec' });
				}
			}
		}

	document.addEventListener('keydown', function (e) {
		if (pickerOverlay.style.display === 'flex') return;
		var names = lang === 1 ? SETTINGS_NAMES_EN : SETTINGS_NAMES;
		switch (e.key) {
			case 'ArrowUp': e.preventDefault(); moveCursor(-1, 0); break;
			case 'ArrowDown': e.preventDefault(); moveCursor(1, 0); break;
			case 'ArrowLeft': e.preventDefault(); moveCursor(0, -1); break;
			case 'ArrowRight': e.preventDefault(); moveCursor(0, 1); break;
			case 'Enter':
				e.preventDefault();
				if (connected) {
					if (hardwareMode === 'settings') {
						if (settingsCursor === names.length - 1) {
							hardwareMode = 'normal';
							settingsEditing = false;
							oledDisplay.classList.remove('oled-settings-mode');
							updateOled();
							sendJSON({ type: 'stoggle' });
						} else if (settingsCursor === 9) {
							sendJSON({ type: 'snav', dir: 'ok' });
						} else if (settingsEditing) {
							settingsEditing = false;
							renderSettingsOled();
							sendJSON({ type: 'snav', dir: 'ok' });
						} else {
							settingsEditing = true;
							renderSettingsOled();
							sendJSON({ type: 'snav', dir: 'ok' });
						}
					} else {
						decrementQty();
					}
				} else {
					decrementQty();
				}
				break;
		}
	});

	// ===== Communication (Serial + BLE) =====

	var serialPort = null;
	var serialReader = null;
	var serialWriter = null;
	var bleDevice = null;
	var bleCharTx = null;
	var bleCharRx = null;
	var connected = false;
	var connectionType = '';
	var serialBuffer = '';
	var bleBuffer = '';
	var btnBoxConnect = document.getElementById('btn-box-connect');
	var connectMenu = document.getElementById('connect-menu');
	var connectSerial = document.getElementById('connect-serial');
	var connectBle = document.getElementById('connect-ble');
	var btnSync = document.getElementById('btn-sync');

	function saveConnType(type) {
		if (autoConnect) {
			try { eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, type); } catch (e) {}
		}
	}

	btnBoxConnect.addEventListener('click', function () {
		if (connected) { doDisconnect(); } else { connectMenu.classList.toggle('show'); }
	});

	document.addEventListener('click', function (e) {
		if (!document.getElementById('connect-dropdown').contains(e.target)) {
			connectMenu.classList.remove('show');
		}
	});

	connectSerial.addEventListener('click', function () { connectMenu.classList.remove('show'); doConnectSerial(); });
	connectBle.addEventListener('click', function () { connectMenu.classList.remove('show'); doConnectBle(); });

	async function doConnectSerial() {
		if (connected) return;
		if (!navigator.serial) { alert(t('web_serial_not_supported')); return; }
		try {
			serialPort = await navigator.serial.requestPort();
			await serialPort.open({ baudRate: 115200 });
			connected = true;
			connectionType = 'serial';
			btnBoxConnect.textContent = t('connected_serial');
			btnBoxConnect.classList.add('btn-serial-disconnect');
			serialWriter = serialPort.writable.getWriter();
			saveConnType('serial');
			onConnected();
			readSerialLoop();
			sendJSON({ type: 'getcursor' });
		} catch (err) { console.error('[Box] Serial connect failed:', err); }
	}

	async function doDisconnect() {
		try {
			if (connectionType === 'serial') {
				connected = false;
				if (serialReader) { try { serialReader.cancel(); serialReader.releaseLock(); } catch (e) {} serialReader = null; }
				if (serialWriter) { try { serialWriter.releaseLock(); } catch (e) {} serialWriter = null; }
				if (serialPort) { try { await serialPort.close(); } catch (e) {} serialPort = null; }
			} else if (connectionType === 'ble') {
				if (bleDevice && bleDevice.gatt.connected) { await bleDevice.gatt.disconnect(); }
				bleDevice = null; bleCharTx = null; bleCharRx = null;
			}
		} catch (err) {}
		connected = false;
		connectionType = '';
		btnBoxConnect.textContent = t('connect_device');
		btnBoxConnect.classList.remove('btn-serial-disconnect');
		btnSync.style.display = 'none';
		onDisconnected();
		try { eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, ''); } catch (e) {}
	}

	async function doConnectBle() {
		if (connected) return;
		if (!navigator.bluetooth) { alert(t('web_bluetooth_not_supported')); return; }
		try {
			bleDevice = await navigator.bluetooth.requestDevice({
				filters: [{ services: [0xFFE0] }],
				optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
			});
			var server = await bleDevice.gatt.connect();
			var service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
			bleCharTx = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
			bleCharRx = await service.getCharacteristic('0000ffe2-0000-1000-8000-00805f9b34fb');

			await bleCharTx.startNotifications();
			bleCharTx.addEventListener('characteristicvaluechanged', function (event) {
				bleBuffer += new TextDecoder().decode(event.target.value);
				processBleBuffer();
			});

			bleDevice.addEventListener('gattserverdisconnected', function () {
				connected = false;
				connectionType = '';
				btnBoxConnect.textContent = t('connect_device');
				btnBoxConnect.classList.remove('btn-serial-disconnect');
				btnSync.style.display = 'none';
				onDisconnected();
				try { eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, ''); } catch (e) {}
			});

			connected = true;
			connectionType = 'ble';
			btnBoxConnect.textContent = t('connected_bluetooth');
			btnBoxConnect.classList.add('btn-serial-disconnect');
			saveConnType('ble');
			onConnected();
			sendJSON({ type: 'getcursor' });
		} catch (err) { console.error('[Box] BLE connect failed:', err); }
	}

	async function readSerialLoop() {
		var decoder = new TextDecoder();
		try {
			serialReader = serialPort.readable.getReader();
			while (connected && connectionType === 'serial') {
				var result = await serialReader.read();
				if (result.done) break;
				serialBuffer += decoder.decode(result.value, { stream: true });
				processSerialBuffer();
			}
		} catch (err) {} finally {
			if (serialReader) { try { serialReader.releaseLock(); } catch (e) {} serialReader = null; }
		}
	}

	function processSerialBuffer() {
		var lines = serialBuffer.split('\n');
		serialBuffer = lines.pop() || '';
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;
			try { handleMessage(JSON.parse(line)); } catch (e) {}
		}
	}

	function processBleBuffer() {
		var lines = bleBuffer.split('\n');
		bleBuffer = lines.pop() || '';
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;
			try { handleMessage(JSON.parse(line)); } catch (e) {}
		}
	}

	function handleMessage(msg) {
		if (msg.type === 'cursor') {
			var row = parseInt(msg.row, 10);
			var col = parseInt(msg.col, 10);
			if (row >= 0 && row < BOX_ROWS && col >= 0 && col < BOX_COLS) {
				cursorRow = row;
				cursorCol = col;
				updateCursorHighlight(true);
			}
		} else if (msg.type === 'oled') {
			oledName.textContent = msg.l1 || '';
			oledQty.textContent = msg.l2 || '';
			oledId.textContent = msg.l3 || '';
		} else if (msg.type === 'mode') {
			hardwareMode = msg.mode || 'normal';
			if (hardwareMode === 'settings') {
				oledDisplay.classList.add('oled-settings-mode');
				settingsCursor = 0;
				settingsEditing = false;
				renderSettingsOled();
			} else {
				oledDisplay.classList.remove('oled-settings-mode');
				settingsEditing = false;
				updateOled();
			}
		} else if (msg.type === 'settings') {
			currentSettings = {
				colorIdx: msg.colorIdx,
				brightIdx: msg.brightIdx,
				idleEffect: msg.idleEffect,
				idleTimeoutIdx: msg.idleTimeoutIdx,
				cursorEffect: msg.cursorEffect,
				contrast: msg.contrast,
				timeoutIdx: msg.timeoutIdx,
				bleOn: msg.bleOn,
				lang: msg.lang
			};
			if (msg.lang !== undefined) {
				lang = msg.lang;
				if (hardwareMode === 'settings') renderSettingsOled();
			}
		} else if (msg.type === 'qtyreport') {
			handleQtyReport(msg.row, msg.col, msg.qty || 0);
		} else if (msg.type === 'synccomplete') {
			if (btnSync.disabled) {
				btnSync.textContent = t('sync_complete');
				setTimeout(function () { btnSync.textContent = t('sync'); btnSync.disabled = false; }, 1500);
			}
		}
	}

	// ===== Hardware sync =====

	function syncCellToHardware(r, c) {
		if (!connected) return;
		var key = r + '-' + c;
		var lcscId = boxMap[key];
		if (lcscId) {
			var dev = devices.find(function (d) { return d.lcscId === lcscId; });
			sendJSON({ type: 'info', row: r, col: c, name: dev ? (dev.name || '') : '', qty: dev ? (dev.quantity || 0) : 0, lcscId: lcscId });
		} else {
			sendJSON({ type: 'clear', row: r, col: c });
		}
	}

	function sendFullGridSync() {
		if (!connected) return;
		for (var r = 0; r < BOX_ROWS; r++) {
			for (var c = 0; c < BOX_COLS; c++) {
				var key = r + '-' + c;
				var lcscId = boxMap[key];
				if (lcscId) {
					var dev = devices.find(function (d) { return d.lcscId === lcscId; });
					sendJSON({ type: 'info', row: r, col: c, name: dev ? (dev.name || '') : '', qty: dev ? (dev.quantity || 0) : 0, lcscId: lcscId });
				} else {
					sendJSON({ type: 'clear', row: r, col: c });
				}
			}
		}
		sendJSON({ type: 'getcursor' });
	}

	var syncCells = [];
	var syncIdx = 0;
	var syncTotal = 0;

	function showSyncProgress(count, name, pos) {
		oledName.textContent = L('同步中 ', 'Syncing ') + count;
		oledQty.textContent = name || '';
		oledId.textContent = pos || '';
	}

	function syncNext() {
		if (syncIdx >= syncTotal) {
			syncActive = false;
			btnSync.disabled = false;
			saveSyncedBoxQty();
			saveSyncedBoxTs();
			updateOled();
			renderBoxGrid();
			updateCursorHighlight();
			sendJSON({ type: 'getcursor' });
			sendJSON({ type: 'synccomplete' });
			btnSync.textContent = t('sync_complete');
			setTimeout(function () { btnSync.textContent = t('sync'); }, 1500);
			return;
		}
		var cell = syncCells[syncIdx];
		var key = cell.row + '-' + cell.col;
		var lcscId = boxMap[key];
		var posStr = (cell.col + 1) + '-' + (cell.row + 1);
		if (lcscId) {
			var dev = devices.find(function (d) { return d.lcscId === lcscId; });
			syncedBoxQty[key] = dev ? (dev.quantity || 0) : 0;
			syncedBoxTs[key] = Date.now();
			showSyncProgress(syncIdx + 1, dev ? (dev.name || '') : '', posStr);
			sendJSON({ type: 'sync', row: cell.row, col: cell.col, name: dev ? (dev.name || '') : '', qty: syncedBoxQty[key], lcscId: lcscId });
		} else {
			showSyncProgress(syncIdx + 1, L('(空)', '(Empty)'), posStr);
			sendJSON({ type: 'clear', row: cell.row, col: cell.col });
			syncIdx++;
			btnSync.textContent = t('sync_progress', syncIdx, syncTotal);
			syncNext();
		}
	}

	function handleQtyReport(row, col, hwQty) {
		if (!syncActive) return;
		var key = row + '-' + col;
		var prevSynced = syncedBoxQty[key] || 0;
		var usage = prevSynced - hwQty;
		if (usage < 0) usage = 0;
		var syncTs = syncedBoxTs[key] || 0;
		var lcscId = boxMap[key];
		if (lcscId) {
			var dev = devices.find(function (d) { return d.lcscId === lcscId; });
			if (dev) {
				var devModified = dev.lastModified || 0;
				var newQty;
				if (devModified > syncTs) {
					// Plugin data is newer (e.g. new import, manual edit)
					newQty = dev.quantity - usage;
				} else {
					// Hardware data is equally or more recent
					newQty = hwQty;
				}
				if (newQty < 0) newQty = 0;
				dev.quantity = newQty;
				dev.lastModified = Date.now();
				syncedBoxQty[key] = newQty;
				try { eda.sys_Storage.setExtensionUserConfig(DEVICES_KEY, JSON.stringify(devices)); } catch (e) {}
			}
		}
		syncIdx++;
		btnSync.textContent = t('sync_progress', syncIdx, syncTotal);
		syncNext();
	}

	btnSync.addEventListener('click', function () {
		if (!connected || syncActive) return;
		loadSyncedBoxQty();
		loadSyncedBoxTs();
		loadDevices();
		syncActive = true;
		btnSync.disabled = true;
		syncCells = [];
		for (var r = 0; r < BOX_ROWS; r++) {
			for (var c = 0; c < BOX_COLS; c++) {
				syncCells.push({ row: r, col: c });
			}
		}
		syncTotal = syncCells.length;
		syncIdx = 0;
		btnSync.textContent = t('sync_progress', 0, syncTotal);
		syncNext();
	});

	// ===== Send queue =====

	var sendQueue = [];
	var sending = false;

	function sendJSON(obj) {
		if (!connected) return;
		sendQueue.push(JSON.stringify(obj) + '\n');
		flushSendQueue();
	}

	async function flushSendQueue() {
		if (sending || sendQueue.length === 0) return;
		sending = true;
		while (sendQueue.length > 0) {
			var str = sendQueue.shift();
			try {
				if (connectionType === 'serial' && serialWriter) {
					serialWriter.write(new TextEncoder().encode(str));
				} else if (connectionType === 'ble' && bleCharRx) {
					await bleCharRx.writeValueWithoutResponse(new TextEncoder().encode(str));
				}
			} catch (err) { console.error('[Box] Send failed:', err); }
		}
		sending = false;
	}

	// ===== Find component (from menu) =====

	function handleFindComponent(lcscId) {
		var foundInBox = null;
		for (var key in boxMap) {
			if (boxMap[key] === lcscId) {
				var parts = key.split('-');
				foundInBox = { row: parseInt(parts[0]), col: parseInt(parts[1]) };
				break;
			}
		}
		var foundInLib = devices.find(function (d) { return d.lcscId === lcscId; });

		if (foundInBox) {
			if (connected) {
				sendJSON({ type: 'goto', row: foundInBox.row, col: foundInBox.col });
			}
			cursorRow = foundInBox.row;
			cursorCol = foundInBox.col;
			updateCursorHighlight();
			eda.sys_Message.showToastMessage(t('found_in_box', (foundInLib ? foundInLib.name : lcscId), (foundInBox.col + 1) + '-' + (foundInBox.row + 1)), 'success');
		} else if (foundInLib) {
			if (connected) {
				sendJSON({ type: 'showinfo', name: foundInLib.name || '', qty: foundInLib.quantity || 0, lcscId: foundInLib.lcscId });
			}
			eda.sys_Message.showToastMessage(t('in_library_not_mapped', (foundInLib.name || lcscId)), 'info');
		} else {
			if (connected) {
				sendJSON({ type: 'shownotfound' });
			}
			eda.sys_Message.showToastMessage(t('not_in_library', lcscId || t('not_selected')), 'error');
		}
		renderBoxGrid();
		updateCursorHighlight();
	}

	// ===== Auto-reconnect =====

	async function tryAutoReconnect() {
		if (!autoConnect) return;
		try {
			var savedType = eda.sys_Storage.getExtensionUserConfig(CONN_TYPE_KEY);
			console.log('[Box] Auto-reconnect check, autoConnect:', autoConnect, 'savedType:', savedType);
			if (!savedType) return;

			if (savedType === 'serial' && navigator.serial) {
				var ports = await navigator.serial.getPorts();
				if (ports.length > 0) {
					serialPort = ports[0];
					await serialPort.open({ baudRate: 115200 });
					connected = true;
					connectionType = 'serial';
					btnBoxConnect.textContent = t('connected_serial');
					btnBoxConnect.classList.add('btn-serial-disconnect');
					serialWriter = serialPort.writable.getWriter();
					onConnected();
					readSerialLoop();
					console.log('[Box] Auto-reconnected serial');
					sendJSON({ type: 'getcursor' });
				}
			} else if (savedType === 'ble' && navigator.bluetooth && typeof navigator.bluetooth.getDevices === 'function') {
				var bleDevices = await navigator.bluetooth.getDevices();
				for (var i = 0; i < bleDevices.length; i++) {
					try {
						var server = await bleDevices[i].gatt.connect();
						var service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
						bleDevice = bleDevices[i];
						bleCharTx = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
						bleCharRx = await service.getCharacteristic('0000ffe2-0000-1000-8000-00805f9b34fb');
						await bleCharTx.startNotifications();
						bleCharTx.addEventListener('characteristicvaluechanged', function (event) {
							bleBuffer += new TextDecoder().decode(event.target.value);
							processBleBuffer();
						});
						bleDevice.addEventListener('gattserverdisconnected', function () {
							connected = false; connectionType = '';
							btnBoxConnect.textContent = t('connect_device');
							btnBoxConnect.classList.remove('btn-serial-disconnect');
							btnSync.style.display = 'none';
							onDisconnected();
							try { eda.sys_Storage.setExtensionUserConfig(CONN_TYPE_KEY, ''); } catch (e) {}
						});
						connected = true; connectionType = 'ble';
						btnBoxConnect.textContent = t('connected_bluetooth');
						btnBoxConnect.classList.add('btn-serial-disconnect');
						onConnected();
						console.log('[Box] Auto-reconnected BLE');
						sendJSON({ type: 'getcursor' });
						break;
					} catch (e) { console.warn('[Box] BLE device failed:', e); }
				}
			}
		} catch (err) { console.warn('[Box] Auto-reconnect failed:', err); }
	}

	// ===== Polling =====

	setInterval(function () {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig('pendingFindAction');
			if (raw) {
				eda.sys_Storage.setExtensionUserConfig('pendingFindAction', '');
				var action = JSON.parse(raw);
				if (action.supplierId) {
					loadDevices();
					loadBoxMap();
					renderBoxGrid();
					handleFindComponent(action.supplierId);
				}
			}
		} catch (e) {}

		try {
			var refreshTs = eda.sys_Storage.getExtensionUserConfig('pendingBoxRefresh');
			if (refreshTs) {
				eda.sys_Storage.setExtensionUserConfig('pendingBoxRefresh', '');
				loadDevices();
				loadBoxMap();
				renderBoxGrid();
				updateCursorHighlight();
			}
		} catch (e) {}
	}, 500);

	// ===== Init =====

	loadAutoConnect();

	tryAutoReconnect();

	loadDevices();
	loadBoxMap();
	loadSyncedBoxQty();
	loadSyncedBoxTs();
	renderBoxGrid();
	updateCursorHighlight();

	try {
		var _raw = eda.sys_Storage.getExtensionUserConfig('pendingFindAction');
		if (_raw) {
			eda.sys_Storage.setExtensionUserConfig('pendingFindAction', '');
			var _action = JSON.parse(_raw);
			if (_action.supplierId) {
				setTimeout(function () { handleFindComponent(_action.supplierId); }, 300);
			}
		}
	} catch (e) {}
})();
