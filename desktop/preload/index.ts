import { contextBridge, ipcRenderer } from 'electron';

export interface FridayBridgeAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  hide: () => void;
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<boolean>;
  onTrayAction: (callback: (action: string) => void) => () => void;
  getLoginItemSettings: () => Promise<any>;
  setLoginItemSettings: (settings: { openAtLogin: boolean; openAsHidden?: boolean }) => Promise<any>;
}

const bridge: FridayBridgeAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  hide: () => ipcRenderer.send('window:hide'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  getLoginItemSettings: () => ipcRenderer.invoke('startup:getLoginItemSettings'),
  setLoginItemSettings: (settings) => ipcRenderer.invoke('startup:setLoginItemSettings', settings),
  onTrayAction: (callback) => {
    const handler = (_: any, action: string) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => {
      ipcRenderer.removeListener('tray:action', handler);
    };
  }
};


contextBridge.exposeInMainWorld('fridayBridge', bridge);
