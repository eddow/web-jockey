# Web-jockey
One-liner tool to have several test applications and static files served under one server.

## Command-line
```sh
  --version      Show version number                                   [boolean]
  -d, --cwd      Working directory                                [default: "."]
  -l, --log      Logging directory
  -c, --config   Config file name                   [default: "web-jockey.yaml"]
  -v, --verbose  Display requests lists                                [boolean]
  -p, --port     Port number
  -h, --help     Show help                                             [boolean]
```
### Notes
- If something is specified in the command-line and in the config, the comand-line value has precedence.
- All file path (even the configuration) if relative is relative to the specified `cwd`
## Config
### Static
```yaml
static:
	/url: path
```
List the URLs that have to be mapped to a local path
### Dynamic
```yaml
dynamic:
	/url: http://forwardUrl:port/sub
```
List the URLs that should forward the request
### Launch
The application can have sub-processes
```yaml
launch:
  name:
    command: myProgram
    args:
		- myArg1
	cwd: myFolder
```
The `name` is used for logging purpose only. The `cwd` and `args` are optional
### Others
- `port`: Port number listened to. Default: 80
- `log`: Log-file directory. If not specified, no logs are written
