#!/usr/bin/env node

// gpx-tools

// No need to use moment: https://momentjs.com/docs/#/-project-status/

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')
const { XMLParser, XMLBuilder } = require('fast-xml-parser')

let config = false
const xmlparseoptions = {
  ignoreAttributes: false
}
const xmlparser = new XMLParser(xmlparseoptions)

const xmlbuilderoptions = {
  attributeNamePrefix: '@_',
  ignoreAttributes: false
}
const xmlbuilder = new XMLBuilder(xmlbuilderoptions)

// Get version from package.json
const packageJson = fs.readFileSync('./package.json')
const version = JSON.parse(packageJson).version || 0
console.log('version', version)
process.env.version = version

const snow = new Intl.DateTimeFormat('en-gb', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date())
const fullversion = 'gpx-tools ' + version + ' - run at ' + snow

// Where GPX data is accumulated:
const output = {
  gpx: {
    wpt: [],
    trk: [],
    '@_version': version,
    '@_creator': 'gpx-tools ' + version
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////
// run: called when run from command line

async function run (argv) {
  let rv = 1
  try {
    console.log(fullversion)
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
    rv = await processInput()

    rv = await generateOutput()

    if (rv) console.log('SUCCESS')
    return 1
  } catch (e) {
    console.error('run EXCEPTION', e)
    return 2
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////
/// ////////////////////////////////////////////////////////////////////////////////////

async function processInput () {
  let rv = 1
  console.log('processInput', config.input.gpx)
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
        await processGPX(file, xmlgpx)
      } catch (err) {
        console.error(err)
      }
    }
    console.log('COMPLETED READING DATA')
    // await importComplete(totalrecords)
  }
  return rv
}

/// ////////////////////////////////////////////////////////////////////////////////////

async function processGPX (file, xmlgpx) {
  if (!xmlgpx.gpx) return
  try {
    if (xmlgpx.gpx.wpt) {
      if( !Array.isArray(xmlgpx.gpx.wpt)){
        xmlgpx.gpx.wpt = [xmlgpx.gpx.wpt]
      }
      for (const waypoint of xmlgpx.gpx.wpt) {
      // console.log('waypoint', waypoint)
        output.gpx.wpt.push(waypoint)
      }
    }
  } catch (e) {
    console.log('Exception', file, e.message)
  }
  try {
    if (xmlgpx.gpx.trk) {
      if( !Array.isArray(xmlgpx.gpx.trk)){
        xmlgpx.gpx.trk = [xmlgpx.gpx.trk]
      }
      for (const track of xmlgpx.gpx.trk) {
      // console.log('track', track)
        output.gpx.trk.push(track)
      }
    }
  } catch (e) {
    console.log('Exception', file, e.message)
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////

async function generateOutput () {
  const xmloutput = '<?xml version="1.0"?>' + xmlbuilder.build(output)
  console.log(xmloutput.length)
  const now = new Date()
  // const outputpath = path.join(__dirname, config.outputFolder + '/' + now.toISOString()+'.gpx')
  const outputpath = path.join(__dirname, config.outputFolder + '/hello.gpx')
  fs.writeFileSync(outputpath, xmloutput, { encoding: 'utf8', flush: true })

  console.log('Created: ', outputpath)
}

/// ////////////////////////////////////////////////////////////////////////////////////
// If called from command line, then run now.
// If testing, then don't.
if (require.main === module) {
  run(process.argv)
}

module.exports = { run }
