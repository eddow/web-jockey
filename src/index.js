#!/usr/bin/env node
const express = require('express'),
	axios = require('axios'),
	yargs = require('yargs'),
	yaml = require('yaml'),
	winston = require('winston'),
	dailyRotateFile = require('winston-daily-rotate-file'),
	path = require('path'),
	{ spawn } = require('child_process'),
	fs = require('fs'),
	{ combine, timestamp, colorize, printf } = winston.format;

const argv = yargs
    .usage('Usage: $0 [options]')
	.alias('d', 'cwd').describe('d', 'Working directory').default('d', '.')
	.alias('l', 'log').describe('l', 'Logging directory')
	.alias('c', 'config').describe('c', 'Config file name').default('c', 'web-jockey.yaml')
	.alias('v', 'verbose').describe('v', 'Display requests lists').boolean('v')
	.alias('p', 'port').describe('p', 'Port number')
    .help('h').alias('h', 'help')
	.argv;

var logDir, port;

function resolve(file) {
	return path.resolve(argv.cwd, file);
}
function resolveLog(file) {
	return path.resolve(logDir, file);
}
function critical(msg, x) {
	logger.crit(x? `${msg}\n${x}` : msg);
	process.exit(1);
}
const myFormat = printf(info => {
	return !info? false :
		'string'=== typeof info.message ?
			`${info.timestamp} [${info.level}] ${info.message}` :
		info.message.app ?
			`${info.timestamp} [${info.level}:${info.message.app}] ${info.message.data}` :
		info.message.req ?
			`${info.timestamp} [${info.level}] ${info.message.descr} -- ${info.message.req.url}` :
		JSON.stringify(info);
});
winston.addColors({
	crit: 'bold inverse red',
	error: 'red',
	warn: 'yellow',
	info: 'blue',
	req: 'yellow'
});
const transports = {
		console: new winston.transports.Console({
			level: 'warn',
			colorize: true,
			prettyPrint: true,
			json: false,
			format: combine(
				colorize(),
				timestamp(),
				myFormat
			)
		})
	},
	logger = winston.createLogger({
		levels: {
			crit: 0,
			error: 1,
			warn: 2,
			req: 3,
			info: 4
		},
		format: combine(
			colorize(),
			timestamp(),
			myFormat
		),
		transports: [
			transports.console
		]
	}),
	startup = logger.startTimer();

if(argv.verbose)
	transports.console.level = 'info';

var file, fileName = resolve(argv.config), config;
try {
	file = fs.readFileSync(fileName, 'utf8')
}catch(x) {
	critical(`Unable to read file ${fileName}`, x)
}
try {
	config = yaml.parse(file);
} catch(x) {
	critical(`Unable to parse YAML ${fileName}`, x)
}
port = argv.port || config.port || 80;
logDir = argv.log || config.log;
if(logDir) {
	logger.add(new dailyRotateFile({
		filename: resolveLog('activity.%DATE%.log'),
    	datePattern: 'YYYY-MM-DD',
		level: 'info',
  		prettyPrint: false,
		colorize: false,
		format: winston.format.json()
	}));
	logger.add(new winston.transports.File({
		filename: resolveLog('errors.log'),
		level: 'error',
  		prettyPrint: false,
		colorize: false,
		format: combine(
			timestamp(),
			myFormat
		)
	}));
}

function addSubProcess(name, cl) {
	const proc = spawn(cl.command, cl.args, {
			cwd: cl.cwd?resolve(cl.cwd):argv.cwd
		});

	proc.stdout.on('data', (data) => {
		logger.info({app: name, data});
	});

	proc.stderr.on('data', (data) => {
		logger.error({app: name, data});
	});

	proc.on('close', (code) => {
		logger.info({app: name, data: `Exited with code ${code}`});
	});
	logger.info({app: name, data: 'Started'});
}

if(config.launch)
	for(let sub in config.launch)
		addSubProcess(sub, config.launch[sub]);

function logged(descr, usage) {
	return function(req, res, next) {
		logger.req({req, descr});
		usage(req, res, next);
	}
}

const app = express();
function useStatic(root, target) {
	app.use(root, logged(`static:${root}`, express.static(resolve(target))));
}
function useDynamic(root, target) {
	app.use(root, logged(`static:${root}`, function(req, res) {
		var headers = req.headers;
		delete headers.host;
		axios.get(target+req.url, {headers}).then(function(resp) {
			res.set(resp.headers);
			res.status(resp.status).send(resp.data);
		}, function(err) {
			var resp = err.response;
			if(!resp)
				logger.error(`${root} not available`);
			else
				res.status(resp.status).send(resp.statusText);
		});
	}));
}
if(config.static)
	for(let root in config.static)
		useStatic(root, config.static[root]);
if(config.dynamic)
	for(let root in config.dynamic)
		useDynamic(root, config.dynamic[root]);

app.listen(port, () => startup.done({message: `Started and listening on ${port}.`}));