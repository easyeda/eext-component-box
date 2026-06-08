const PLUGIN_TAG = '[MyComponentLib]';

export function activate(): void {
	console.warn(PLUGIN_TAG, 'Plugin activated');
}

export async function openLibrary(): Promise<void> {
	try {
		await eda.sys_IFrame.openIFrame('/iframe/index.html', 900, 650, 'my-component-library', {
			title: eda.sys_I18n.text('personal_component_library'),
			maximizeButton: true,
			minimizeButton: true,
		});
	}
	catch (err) {
		console.error(PLUGIN_TAG, 'Failed to open library iframe:', err);
	}
}

export async function openBox(): Promise<void> {
	try {
		await eda.sys_IFrame.openIFrame('/iframe/box.html', 600, 580, 'component-box', {
			title: eda.sys_I18n.text('component_box'),
			maximizeButton: true,
			minimizeButton: true,
		});
	}
	catch (err) {
		console.error(PLUGIN_TAG, 'Failed to open box iframe:', err);
	}
}

export async function connectBox(): Promise<void> {
	await openBox();
}

export async function findSelectedComponent(): Promise<void> {
	try {
		const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!docInfo) {
			console.warn(PLUGIN_TAG, 'No document open');
			return;
		}

		const docType = docInfo.documentType;
		let supplierId = '';

		if (docType === 1) {
			const selected = await eda.sch_SelectControl.getAllSelectedPrimitives();
			if (selected && selected.length > 0) {
				const comp = selected[0] as any;
				if (typeof comp.getState_SupplierId === 'function') {
					supplierId = comp.getState_SupplierId() || '';
				}
			}
		}
		else if (docType === 3) {
			const selected = await eda.pcb_SelectControl.getAllSelectedPrimitives();
			if (selected && selected.length > 0) {
				const comp = selected[0] as any;
				if (typeof comp.getState_SupplierId === 'function') {
					supplierId = comp.getState_SupplierId() || '';
				}
			}
		}

		if (!supplierId) {
			return;
		}

		// Check box map
		let inBox = false;
		try {
			const boxRaw = eda.sys_Storage.getExtensionUserConfig('myComponentLibBox');
			if (boxRaw) {
				const boxMap = JSON.parse(boxRaw);
				for (const key in boxMap) {
					if (boxMap[key] === supplierId) {
						inBox = true;
						break;
					}
				}
			}
		}
		catch {
			// ignore parse errors
		}

		// Check device library
		let inLib = false;
		try {
			const devRaw = eda.sys_Storage.getExtensionUserConfig('myComponentLibDevices');
			if (devRaw) {
				const devices = JSON.parse(devRaw);
				inLib = devices.some((d: any) => d.lcscId === supplierId);
			}
		}
		catch {
			// ignore parse errors
		}

		if (inBox || !inLib) {
			// In box, or not found anywhere → open box.html
			await eda.sys_Storage.setExtensionUserConfig('pendingFindAction', JSON.stringify({
				supplierId,
				timestamp: Date.now(),
			}));
			await openBox();
		}
		else {
			// In library but NOT in box → open main library
			await openLibrary();
		}
	}
	catch (err) {
		console.error(PLUGIN_TAG, 'Find selected component failed:', err);
	}
}
