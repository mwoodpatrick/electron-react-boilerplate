# mib-browser

A Simple MIB Browser to query SNMP values.

Usage: mib-reader [options]

```

Options:
  -c, --community <name>       community (default: "public")
  -d, --debug                  output extra debugging (default: true)
  -f, --config <path>          specify config file
  -g, --gui                    enable GUI
  -i, --info                   generate additional result details
  -j, --json                   generate JSON rather than XML
  -o, --oids <oids...>         specify oids of interest
  -p, --port <port>            specify port to use (default: "161")
  -r, --results <path>         specify path to write results to (default:
                               "161")
  -t, --targets <device...>    target devices
  -V, --version                output the version number
  -v, --snmpVersion <version>  snmp version (choices: "1", "2c", "3")
  -w, --walk                   Output the MIB tree at the specified OIDs
                               (default: false)
  -h, --help                   display help for command

```

Examples:

Gather some data based on the config file and generate results

> mib-browser.exe -d -i --config config.json -r results/myresults

Ditto but enable the GUI (does not do much right now)

> mib-browser.exe -d -i --config config.json -r results/myresults --gui

Get details on command line optiuons:

> mib-browser.exe -d -h

# Sample Config file

```
{
  "version": "2c",
  "walk": false,
  "community": "public",
  "targets": ["10.1.4.45", "10.1.4.46"],
  "oids": [
    "1.3.6.1.2.1.1.5.0",
    "1.3.6.1.2.1.1.6.0"
  ]
}
```
