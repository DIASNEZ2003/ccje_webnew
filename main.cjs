const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow () {
  const iconPath = isDev 
    ? path.join(__dirname, 'public', 'logo.png') 
    : path.join(__dirname, 'dist', 'logo.png');

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
    // Add your app name here
    title: 'CCJE License Management System', 
    webPreferences: {
      nodeIntegration: true, 
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});