/* eslint-disable max-classes-per-file */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFile } from 'fs';
import snmp = require('net-snmp');
import { Command, Option } from 'commander';
import xml = require('xml');
import { promisify } from 'util';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const writeFileAsync = promisify(writeFile);

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

const setupGUI = () => {
  ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply('ipc-example', msgTemplate('pong'));
  });

  if (process.env.NODE_ENV === 'production') {
    const sourceMapSupport = require('source-map-support');
    sourceMapSupport.install();
  }

  if (isDevelopment) {
    // require('electron-debug')();
  }

  /**
   * Add event listeners...
   */

  app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app
    .whenReady()
    .then(() => {
      createWindow();
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);
};

const supportedSNMPVersions = new Map([
  ['1', snmp.Version1],
  ['2c', snmp.Version2c],
  ['3', snmp.Version3],
]);
class MIBReaderConfig {
  community: string;

  gui: boolean;

  info: boolean;

  json: boolean;

  results: string;

  version: snmp.Version1 | snmp.Version2c | snmp.Version3;

  port: number;

  trapPort: number;

  targets: string[];

  oids: string[];

  debug: boolean;

  walk: boolean;

  maxRepetitions: number;

  retries: number;

  timeout: number;

  backoff: number;

  transport: 'udp4' | 'udp6';

  backwardsGetNexts: boolean;

  idBitsSize: number;

  constructor() {
    this.community = 'public';
    this.gui = false;
    this.info = false;
    this.json = false;
    this.results = 'myresults';
    this.version = snmp.Version2c;
    this.port = 161;
    this.trapPort = 162;
    this.targets = [];
    this.oids = [];
    this.debug = process.env.IS_DEBUG_MODE === 'true';
    this.debug = true;
    this.walk = false;
    this.maxRepetitions = 20;
    this.retries = 10;
    this.timeout = 5000;
    this.backoff = 1.0;
    this.transport = 'udp4';
    this.backwardsGetNexts = true;
    this.idBitsSize = 32;
  }

  validate() {
    if (this.transport !== 'udp4') console.log('invalid transport!');
  }

  initFromRaw(raw: any, source: string) {
    const keys = Object.keys(raw);

    keys.forEach((key) => {
      if (key in this)
        if (key === 'version') this[key] = supportedSNMPVersions[raw[key]];
        else if (['port', 'trapPort'].findIndex((x) => x === key) >= 0)
          this[key] = parseInt(raw[key], 10);
        else this[key] = raw[key];
      else if (key !== 'config')
        throw new Error(`unknown field ${key} in '${source}`);
    });

    this.validate();
  }
}
class MIBReader {
  config: MIBReaderConfig;

  appVersion: string;

  entryMap: any[];

  promises: any[];

  results: any[];

  store: any;

  constructor(argv: string[]) {
    console.log('** starting app **');
    this.appVersion = '0.0.1';
    this.config = new MIBReaderConfig();
    this.entryMap = [];
    this.promises = [];
    this.results = [];

    this.processCommandLine(argv);

    if (!this.config.json)
      this.results.push('<?xml version="1.0" encoding="UTF-8"?>', '<results>');

    // Create a module store, load a MIB module, and fetch its JSON representation
    this.store = snmp.createModuleStore();

    // store.loadFromFile ('/mnt/wsl/projects/git/www/park-sierra/node_modules/net-snmp/lib/mibs/SNMPv2-MIB.mib')

    const moduleNames = Object.keys(this.store.parser.Modules);

    moduleNames.forEach((moduleName) => {
      // const jsonModule = store.getModule('SNMPv2-MIB')
      const jsonModule = this.store.getModule(moduleName);
      const names = Object.keys(jsonModule);

      names.forEach((name) => {
        const entry = jsonModule[name];
        // this.debug('entry=' + name)
        // this.log(entry)
        if (entry.OID) this.entryMap[entry.OID] = entry;
        this.entryMap[`${entry.OID}.0`] = entry;
      });

      this.debug(`module=${moduleName}`);
    });
  }

  parseJSON(p: string, source: string) {
    const raw = JSON.parse(p);

    this.config.initFromRaw(raw, `config file '${source}`);
  }

  // eslint-disable-next-line class-methods-use-this
  log(msg: string) {
    console.log(msg);
  }

  debug(msg: string) {
    if (this.config.debug) console.log(msg);
  }

  processCommandLine(argv: string[]) {
    for (let j = 2; j < argv.length; j += 1) {
      this.debug(`${j} -> ${argv[j]}`);
      if (argv[j] === '-f' || argv[j] === '--config') {
        this.parseJSON(
          readFileSync(argv[j + 1], { encoding: 'utf-8' }),
          argv[j + 1]
        );
        j += 1;
      }
    }

    const program = new Command('mib-reader')
      .allowUnknownOption()
      .option('-c, --community <name>', 'community', this.config.community)
      .option('-d, --debug', 'output extra debugging', this.config.debug)
      .option('-f, --config <path>', 'specify config file')
      .option('-g, --gui', 'enable GUI')
      .option('-i, --info', 'generate additional result details')
      .option('-j, --json', 'generate JSON rather than XML')
      .option('-o, --oids <oids...>', 'specify oids of interest')
      .option(
        '-p, --port <port>',
        'specify port to use',
        this.config.port.toString()
      )
      .option(
        '-r, --results <path>',
        'specify path to write results to',
        this.config.port.toString()
      )
      .option('-t, --targets <device...>', 'target devices')
      .version(this.appVersion)
      .addOption(
        new Option('-v, --snmpVersion <version>', 'snmp version').choices([
          '1',
          '2c',
          '3',
        ])
      )
      .option(
        '-w, --walk',
        'Output the MIB tree at the specified OIDs',
        this.config.walk
      )
      .parse(argv);
    const options = program.opts();

    this.config.initFromRaw(options, 'command line');

    if (this.config.debug) this.log('Running in debug mode');

    this.debug(`snmpOptions=${this.config}`);
  }

  dumpEntry(target, v) {
    const result = {
      target,
      oid: v.oid,
      value: `${v.value}`,
    } as any;

    if (this.config.info) {
      result.type = snmp.ObjectType[v.type];

      if (this.entryMap[v.oid]) {
        const entry = this.entryMap[v.oid];
        this.log(entry);
        result.description = entry.DESCRIPTION;
        result.module = entry.ModuleName;
        result.namespace = entry.NameSpace;
        result.name = entry.ObjectName;
        result.status = entry.STATUS;
      }
    }

    if (this.config.json) {
      this.results.push(result);
    } else {
      const x = xml({ result: { _attr: result } });
      this.results.push(x);
    }

    this.log(
      `result target='${target} oid='${v.oid}' value='${v.value}' type='${
        v.type
      } (${snmp.ObjectType[v.type]})'`
    );
    this.log(v);
    if (this.entryMap[v.oid]) {
      const entry = this.entryMap[v.oid];
      this.log(entry);
    }
  }

  dumpEntries(target, varbinds) {
    for (let i = 0; i < varbinds.length; i += 1) {
      if (snmp.isVarbindError(varbinds[i]))
        console.error(snmp.varbindError(varbinds[i]));
      else this.dumpEntry(target, varbinds[i]);
    }
  }

  captureResults(): void {
    this.config.targets.forEach((target) => {
      if (this.config.walk) {
        this.config.oids.forEach((oid) => {
          const session = snmp.createSession(
            target,
            this.config.community,
            this.config
          );

          const p = new Promise((resolve, reject) => {
            function feedCb(varbinds) {
              this.dumpEntries(target, varbinds);
            }

            function doneCb(error) {
              session.close();
              if (error) reject(error.toString());
              else resolve('done');
            }

            // The maxRepetitions argument is optional, and will be ignored unless using
            // SNMP verison 2c

            session.walk(oid, this.config.maxRepetitions, feedCb, doneCb);
          });

          this.promises.push(p);
        });
      } else {
        const session = snmp.createSession(
          target,
          this.config.community,
          this.config
        );

        const p = new Promise((resolve, reject) => {
          session.get(this.config.oids, (error, varbinds) => {
            session.close();

            if (error) {
              reject(error);
            } else {
              this.dumpEntries(target, varbinds);
              resolve('done');
            }
          });
        });

        this.promises.push(p);
      }

      Promise.all(this.promises)
        .then(() => {
          this.log('all results captured');
          this.reportResults();
        })
        .catch((err) => {
          console.error('Promise.all error', err);
        });
    });
  }

  async reportResults() {
    const suffix = this.config.json ? 'json' : 'xml';
    const rpath = `${this.config.results}.${suffix}`;

    if (this.config.json)
      await writeFileAsync(
        rpath,
        JSON.stringify(this.results, null, 2),
        'utf8'
      );
    else {
      this.results.push('</results>');
      await writeFileAsync(rpath, this.results.join('\n'), 'utf8');
    }

    this.log(`results generated in ${rpath}`);

    if (this.config.gui) setupGUI();
    else app.quit();
  }
}

debugger; // eslint-disable-line no-debugger

const mibReader = new MIBReader(process.argv);

mibReader.captureResults();
