#!/usr/bin/env node

// geojson-tools

// For each new release, update in package.json and create a new tag in GitHub - used in version string

// No need to use moment: https://momentjs.com/docs/#/-project-status/

const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync
const { glob } = require('glob')
const { XMLParser } = require('fast-xml-parser')

let config = false
const xmlparser = new XMLParser()

// Get version from last git commit
// console.log(new Date().toLocaleDateString('en-gb'))
const snow = new Intl.DateTimeFormat('en-gb', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date())
let version = 'gpx-tools - run at ' + snow
try {
  const gitdescr = execSync('git describe --tags --long')
  version += ' ' + gitdescr.toString('utf8', 0, gitdescr.length - 1)
} catch (e) { }

/// ////////////////////////////////////////////////////////////////////////////////////
// run: called when run from command line

async function run (argv) {
  let rv = 1
  try {
    console.log(version)
    // Display usage
    if (argv.length <= 2) {
      console.error('usage: node gpx-tools.js <config.json>')
      return 0
    }

    // Load config file and remove UTF-8 BOF and any comments starting with //
    let configtext = fs.readFileSync(path.resolve(__dirname, argv[2]), { encoding: 'utf8' })
    if (configtext.charCodeAt(0) === 65279) { // Remove UTF-8 start character
      configtext = configtext.slice(1)
    }
    while (true) {
      const dslashpos = configtext.indexOf('//')
      if (dslashpos === -1) break
      const endlinepos = configtext.indexOf('\n', dslashpos)
      if (endlinepos === -1) {
        configtext = configtext.substring(0, dslashpos)
        break
      }
      configtext = configtext.substring(0, dslashpos) + configtext.substring(endlinepos)
    }
    // console.log(configtext)
    try {
      config = JSON.parse(configtext)
    } catch (e) {
      console.error('config file not in JSON format')
      return 0
    }
    console.log(config)

    // Make output folder if need be
    fs.mkdirSync(path.join(__dirname, config.outputFolder), { recursive: true })

    // let totalrecords = 0
    rv = await processFiles()

    if (rv) console.log('SUCCESS')
    return 1
  } catch (e) {
    console.error('run EXCEPTION', e)
    return 2
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////
/// ////////////////////////////////////////////////////////////////////////////////////

async function processFiles () {
  let rv = 1
  console.log('processFiles', config.input.gpx)
  const files = await glob(config.input.gpx)
  if (files.length === 0) {
    console.error('NO FILE(S) FOUND FOR: ', config.input.gpx)
    rv = 0
  } else {
    // const donecount = 0
    // for (const file of Object.values(files)) {
    for (const file of files) {
      console.log(file)
      try {
        const data = fs.readFileSync(file, config.input.encoding)
        console.log('data', data.length)
        const xmlgpx = xmlparser.parse(data)
        // console.log('xmlgpx', xmlgpx)
        await processGPX(xmlgpx)
      } catch (err) {
        console.error(err)
      }
    }
    console.log('COMPLETED READING DATA')
    // await importComplete(totalrecords)
  }
  return rv
}

async function processGPX (xmlgpx) {
  if (!xmlgpx.gpx) return
  if (xmlgpx.gpx.wpt) {
    for (const waypoint of xmlgpx.gpx.wpt) {
      console.log('waypoint', waypoint)
    }
  }
  if (xmlgpx.gpx.trk) {
    for (const track of xmlgpx.gpx.trk) {
      console.log('track', track)
    }
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////
// If called from command line, then run now.
// If testing, then don't.
if (require.main === module) {
  run(process.argv)
}

module.exports = { run }
