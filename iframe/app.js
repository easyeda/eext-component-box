(function () {
	var STORAGE_KEY = 'myComponentLibDevices';
	var btnImport = document.getElementById('btn-import');
	var btnBox = document.getElementById('btn-box');
	var statusEl = document.getElementById('status');
	var tbody = document.getElementById('device-tbody');
	var emptyTip = document.getElementById('empty-tip');
	var table = document.getElementById('device-table');
	var modalOverlay = document.getElementById('modal-overlay');
	var modalBody = document.getElementById('modal-body');
	var modalSave = document.getElementById('modal-save');
	var modalDelete = document.getElementById('modal-delete');
	var modalClose = document.getElementById('modal-close');

	var devices = [];
	var editingIndex = -1;
	var deleteMode = false;
	var deleteChecked = {};
	var searchKeyword = '';

	function setStatus(text, type) {
		statusEl.textContent = text;
		statusEl.className = 'status ' + (type || '');
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	function getFilteredDevices() {
		if (!searchKeyword) return devices.map(function (d, i) { return { d: d, i: i }; });
		var kw = searchKeyword.toLowerCase();
		var result = [];
		for (var i = 0; i < devices.length; i++) {
			var d = devices[i];
			if ((d.lcscId || '').toLowerCase().indexOf(kw) !== -1 ||
				(d.name || '').toLowerCase().indexOf(kw) !== -1 ||
				(d.description || '').toLowerCase().indexOf(kw) !== -1 ||
				(d.manufacturer || '').toLowerCase().indexOf(kw) !== -1) {
				result.push({ d: d, i: i });
			}
		}
		return result;
	}

	function renderTable() {
		if (devices.length === 0) {
			table.style.display = 'none';
			emptyTip.style.display = 'block';
			return;
		}
		var filtered = getFilteredDevices();
		if (filtered.length === 0) {
			table.style.display = 'none';
			emptyTip.style.display = 'block';
			emptyTip.textContent = t('no_matching_components');
			return;
		}
		table.style.display = 'table';
		emptyTip.style.display = 'none';
		emptyTip.textContent = t('no_components_tip');

		tbody.innerHTML = filtered.map(function (item) {
			var d = item.d;
			var i = item.i;
			var qtyClass = d.quantity <= 0 ? ' class="quantity-zero"' : '';
			var cbCell = deleteMode ? '<td><input type="checkbox" class="del-cb" data-idx="' + i + '"' + (deleteChecked[i] ? ' checked' : '') + ' /></td>' : '';
			return '<tr>' +
				cbCell +
				'<td' + qtyClass + '>' + (d.quantity || 0) + '</td>' +
				'<td>' + escapeHtml(d.lcscId || '') + '</td>' +
				'<td title="' + escapeHtml(d.name || '') + '">' + escapeHtml(d.name || '-') + '</td>' +
				'<td title="' + escapeHtml(d.footprint || '') + '">' + escapeHtml(d.footprint || '-') + '</td>' +
				'<td title="' + escapeHtml(d.description || '') + '">' + escapeHtml(d.description || '-') + '</td>' +
				'<td title="' + escapeHtml(d.manufacturer || '') + '">' + escapeHtml(d.manufacturer || '-') + '</td>' +
				'<td><div class="action-btns">' +
					'<button type="button" class="btn btn-sm btn-primary" onclick="window._editDevice(' + i + ')">' + t('edit') + '</button>' +
					'<button type="button" class="btn btn-sm btn-success" onclick="window._useDevice(' + i + ')">' + t('use') + '</button>' +
				'</div></td>' +
				'</tr>';
		}).join('');

		if (deleteMode) {
			var thead = table.querySelector('thead tr');
			if (thead && !thead.querySelector('.del-th')) {
				var th = document.createElement('th');
				th.className = 'del-th';
				thead.insertBefore(th, thead.firstChild);
			}
		} else {
			var delTh = table.querySelector('.del-th');
			if (delTh) delTh.remove();
		}

		if (deleteMode) {
			var cbs = tbody.querySelectorAll('.del-cb');
			cbs.forEach(function (cb) {
				cb.addEventListener('change', function () {
					var idx = parseInt(cb.dataset.idx, 10);
					if (cb.checked) deleteChecked[idx] = true;
					else delete deleteChecked[idx];
				});
			});
		}
	}

	async function saveDevices() {
		try {
			await eda.sys_Storage.setExtensionUserConfig(STORAGE_KEY, JSON.stringify(devices));
		} catch (err) {
			console.error('[MyComponentLib]', 'Failed to save devices:', err);
		}
	}

	async function loadDevices() {
		try {
			var raw = eda.sys_Storage.getExtensionUserConfig(STORAGE_KEY);
			if (raw) {
				devices = JSON.parse(raw);
			}
		} catch (err) {
			console.error('[MyComponentLib]', 'Failed to load devices:', err);
		}
		renderTable();
	}

	async function notifyBoxRefresh() {
		try {
			await eda.sys_Storage.setExtensionUserConfig('pendingBoxRefresh', JSON.stringify({ timestamp: Date.now() }));
		} catch (e) {}
	}

	function extractLcscIds(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function (e) {
				try {
					var data = new Uint8Array(e.target.result);
					var workbook = XLSX.read(data, { type: 'array' });
					var sheet = workbook.Sheets[workbook.SheetNames[0]];
					var rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

					if (rows.length < 2) {
						reject(new Error(t('table_empty')));
						return;
					}

					var headerRowIndex = -1;
					var colIndex = -1;
					var qtyColIndex = -1;
					for (var r = 0; r < rows.length; r++) {
						var row = rows[r];
						if (!row) continue;
						for (var c = 0; c < row.length; c++) {
							var cell = String(row[c] || '').trim();
							if (cell === '商品编号' || cell === '立创商城编号' || cell === 'LCSC Part Number' || cell === '物料编号') {
								headerRowIndex = r;
								colIndex = c;
								break;
							}
						}
						if (colIndex !== -1) break;
					}

					if (colIndex === -1) {
						reject(new Error(t('column_not_found')));
						return;
					}

					var headerRow = rows[headerRowIndex];
					for (var c = 0; c < headerRow.length; c++) {
						var cell = String(headerRow[c] || '').trim();
						if (cell.indexOf('数量') !== -1 || cell.indexOf('订购') !== -1) {
							qtyColIndex = c;
							break;
						}
					}

					var items = [];
					for (var r = headerRowIndex + 1; r < rows.length; r++) {
						if (!rows[r]) continue;
						var val = String(rows[r][colIndex] || '').trim();
						if (val && /^C\d+$/i.test(val)) {
							var qty = 1;
							if (qtyColIndex !== -1) {
								var qtyStr = String(rows[r][qtyColIndex] || '').replace(/[^\d]/g, '');
								qty = parseInt(qtyStr, 10) || 1;
							}
							var existing = items.find(function (it) { return it.id === val; });
							if (existing) {
								existing.qty += qty;
							} else {
								items.push({ id: val, qty: qty });
							}
						}
					}

					if (items.length === 0) {
						reject(new Error(t('no_valid_product_ids')));
						return;
					}

					resolve(items);
				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = function () {
				reject(new Error(t('file_read_failed')));
			};
			reader.readAsArrayBuffer(file);
		});
	}

	async function fetchDeviceInfo(items) {
		var BATCH_SIZE = 20;
		var results = [];
		var allIds = items.map(function (it) { return it.id; });

		for (var i = 0; i < allIds.length; i += BATCH_SIZE) {
			var batchIds = allIds.slice(i, i + BATCH_SIZE);
			var batchItems = items.slice(i, i + BATCH_SIZE);
			setStatus(t('querying_component_info', Math.min(i + BATCH_SIZE, allIds.length), allIds.length), 'loading');

			try {
				var apiResults = await eda.lib_Device.getByLcscIds(batchIds);
				console.warn('[MyComponentLib]', 'Batch result:', JSON.stringify(apiResults, null, 2));

				for (var k = 0; k < batchItems.length; k++) {
					var lcscId = batchItems[k].id;
					var qty = batchItems[k].qty;
					var matched = null;
					if (apiResults && apiResults.length > 0) {
						matched = apiResults.find(function (r) { return r.supplierId === lcscId; });
					}

					if (matched) {
						var lcscPartName = (matched.otherProperty && matched.otherProperty['LCSC Part Name']) || '';
						results.push({
							lcscId: lcscId,
							name: matched.manufacturerId || matched.name || '',
							footprint: (matched.footprint && matched.footprint.name) || matched.footprintName || '',
							description: lcscPartName || matched.description || '',
							manufacturer: matched.manufacturer || '',
							uuid: matched.uuid || '',
							libraryUuid: matched.libraryUuid || '',
							quantity: qty,
							lastModified: Date.now(),
						});
					} else {
						results.push({
							lcscId: lcscId,
							name: t('not_found'),
							footprint: '-',
							description: '-',
							manufacturer: '-',
							uuid: '',
							libraryUuid: '',
							quantity: qty,
							lastModified: Date.now(),
						});
					}
				}
			} catch (err) {
				console.error('[MyComponentLib]', 'Batch query failed:', err);
				for (var k = 0; k < batchItems.length; k++) {
					results.push({
						lcscId: batchItems[k].id,
						name: t('query_failed'),
						footprint: '-',
						description: '-',
						manufacturer: '-',
						uuid: '',
						libraryUuid: '',
						quantity: batchItems[k].qty,
					});
				}
			}
		}

		return results;
	}

	// Edit modal
	function openEditModal(index) {
		editingIndex = index;
		var d = devices[index];
		modalBody.innerHTML =
			'<div class="form-group"><label>' + t('product_id') + '</label><input id="edit-lcscId" value="' + escapeHtml(d.lcscId || '') + '" /></div>' +
			'<div class="form-group"><label>' + t('component_name') + '</label><input id="edit-name" value="' + escapeHtml(d.name || '') + '" /></div>' +
			'<div class="form-group"><label>' + t('package') + '</label><input id="edit-footprint" value="' + escapeHtml(d.footprint || '') + '" /></div>' +
			'<div class="form-group"><label>' + t('description') + '</label><input id="edit-description" value="' + escapeHtml(d.description || '') + '" /></div>' +
			'<div class="form-group"><label>' + t('manufacturer') + '</label><input id="edit-manufacturer" value="' + escapeHtml(d.manufacturer || '') + '" /></div>' +
			'<div class="form-group"><label>' + t('quantity') + '</label><input id="edit-quantity" type="number" min="0" value="' + (d.quantity || 0) + '" /></div>';
		modalOverlay.style.display = 'flex';
	}

	function closeModal() {
		modalOverlay.style.display = 'none';
		editingIndex = -1;
	}

	modalClose.addEventListener('click', closeModal);
	modalOverlay.addEventListener('click', function (e) {
		if (e.target === modalOverlay) closeModal();
	});

	modalSave.addEventListener('click', async function () {
		if (editingIndex < 0) return;
		var d = devices[editingIndex];
		d.lcscId = document.getElementById('edit-lcscId').value.trim();
		d.name = document.getElementById('edit-name').value.trim();
		d.footprint = document.getElementById('edit-footprint').value.trim();
		d.description = document.getElementById('edit-description').value.trim();
		d.manufacturer = document.getElementById('edit-manufacturer').value.trim();
		d.quantity = parseInt(document.getElementById('edit-quantity').value, 10) || 0;
		d.lastModified = Date.now();
		renderTable();
		await saveDevices();
		closeModal();
		setStatus(t('saved'), '');
		await notifyBoxRefresh();
	});

	modalDelete.addEventListener('click', async function () {
		if (editingIndex < 0) return;
		devices.splice(editingIndex, 1);
		renderTable();
		await saveDevices();
		closeModal();
		setStatus(t('deleted'), '');
		await notifyBoxRefresh();
	});

	// Use device - place in SCH or PCB
	async function useDevice(index) {
		var d = devices[index];
		if (!d.uuid || !d.libraryUuid) {
			setStatus(t('no_library_info'), 'error');
			return;
		}

		try {
			var docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
			if (!docInfo) {
				setStatus(t('open_document_first'), 'error');
				return;
			}

			var docType = docInfo.documentType;
			var component = { libraryUuid: d.libraryUuid, uuid: d.uuid };

			if (docType === 1) {
				var result = await eda.sch_PrimitiveComponent.placeComponentWithMouse(component);
				if (result) {
					d.quantity = Math.max(0, (d.quantity || 0) - 1);
					renderTable();
					await saveDevices();
					setStatus(t('placed_to_schematic_remaining', d.quantity), '');
					await notifyBoxRefresh();
				} else {
					setStatus(t('placement_cancelled'), '');
				}
			} else if (docType === 3) {
				var result = await eda.pcb_PrimitiveComponent.create(component, 1, 0, 0);
				if (result) {
					d.quantity = Math.max(0, (d.quantity || 0) - 1);
					renderTable();
					await saveDevices();
					setStatus(t('placed_to_pcb_remaining', d.quantity), '');
					await notifyBoxRefresh();
				} else {
					setStatus(t('placement_failed'), 'error');
				}
			} else {
				setStatus(t('not_schematic_or_pcb'), 'error');
			}
		} catch (err) {
			console.error('[MyComponentLib]', 'Place device failed:', err);
			setStatus(t('placement_failed_message', err.message), 'error');
		}
	}

	// Expose to onclick
	window._editDevice = openEditModal;
	window._useDevice = useDevice;

	// Import
	btnImport.addEventListener('click', async function () {
		try {
			var file = await eda.sys_FileSystem.openReadFileDialog(['.xls', '.xlsx'], false);
			if (!file) return;

			setStatus(t('parsing_table'), 'loading');
			var items = await extractLcscIds(file);
			setStatus(t('found_ids_querying', items.length), 'loading');

			var newDevices = await fetchDeviceInfo(items);

			for (var i = 0; i < newDevices.length; i++) {
				var existing = devices.find(function (d) { return d.lcscId === newDevices[i].lcscId; });
				if (existing) {
					existing.quantity = (existing.quantity || 0) + newDevices[i].quantity;
					existing.lastModified = Date.now();
				} else {
					devices.push(newDevices[i]);
				}
			}

			renderTable();
			await saveDevices();
			setStatus(t('import_complete', devices.length), '');
			await notifyBoxRefresh();
		} catch (err) {
			console.error('[MyComponentLib]', 'Import failed:', err);
			setStatus(t('import_failed', err.message), 'error');
		}
	});

	// Search
	var searchInput = document.getElementById('search-input');
	searchInput.addEventListener('input', function () {
		searchKeyword = searchInput.value.trim();
		renderTable();
	});

	// Delete mode
	var btnDeleteMode = document.getElementById('btn-delete-mode');
	var btnSelectAll = document.getElementById('btn-select-all');
	var btnConfirmDelete = document.getElementById('btn-confirm-delete');
	var btnCancelDelete = document.getElementById('btn-cancel-delete');

	function enterDeleteMode() {
		deleteMode = true;
		deleteChecked = {};
		btnDeleteMode.style.display = 'none';
		btnSelectAll.style.display = '';
		btnConfirmDelete.style.display = '';
		btnCancelDelete.style.display = '';
		renderTable();
	}

	function exitDeleteMode() {
		deleteMode = false;
		deleteChecked = {};
		btnDeleteMode.style.display = '';
		btnSelectAll.style.display = 'none';
		btnConfirmDelete.style.display = 'none';
		btnCancelDelete.style.display = 'none';
		renderTable();
	}

	btnDeleteMode.addEventListener('click', function () {
		if (devices.length === 0) return;
		enterDeleteMode();
	});

	btnCancelDelete.addEventListener('click', function () {
		exitDeleteMode();
	});

	btnSelectAll.addEventListener('click', function () {
		var filtered = getFilteredDevices();
		var allChecked = filtered.every(function (item) { return deleteChecked[item.i]; });
		if (allChecked) {
			filtered.forEach(function (item) { delete deleteChecked[item.i]; });
		} else {
			filtered.forEach(function (item) { deleteChecked[item.i] = true; });
		}
		renderTable();
	});

	btnConfirmDelete.addEventListener('click', async function () {
		var indices = Object.keys(deleteChecked).map(Number).sort(function (a, b) { return b - a; });
		if (indices.length === 0) {
			setStatus(t('none_selected'), '');
			return;
		}
		var confirmed = confirm(t('confirm_delete_selected', indices.length));
		if (!confirmed) return;
		for (var i = 0; i < indices.length; i++) {
			devices.splice(indices[i], 1);
		}
		exitDeleteMode();
		await saveDevices();
		setStatus(t('deleted_count', indices.length), '');
		await notifyBoxRefresh();
	});

	// Open box iframe
	btnBox.addEventListener('click', async function () {
		try {
			await eda.sys_IFrame.openIFrame('/iframe/box.html', 600, 580, 'component-box', {
				title: t('component_box'),
				maximizeButton: true,
				minimizeButton: true,
			});
		} catch (err) {
			console.error('[MyComponentLib]', 'Failed to open box iframe:', err);
		}
	});

	loadDevices();
})();
