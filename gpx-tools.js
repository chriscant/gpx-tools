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
const outputTrkpts = []

let filesRead = 0
let fails = 0
let failmessages = ''
let notgpx = 0
let inputtracks = 0
let validtracks = 0
let uniquetracks = 0
let duplicatetracks = 0
let emptytracks = 0
let uniquetrackpts = 0
let inputwaypoints = 0
let duplicatewaypoints = 0
let uniquewaypoints = 0

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

    console.log('==================')
    console.log('  filesRead', filesRead)
    console.log('  fails', fails, failmessages)
    console.log('  notgpx', notgpx)
    console.log('  inputtracks', inputtracks)
    console.log('  emptytracks', emptytracks)
    console.log('  validtracks', validtracks)
    console.log('  duplicatetracks', duplicatetracks)
    console.log('* uniquetracks', uniquetracks)
    console.log('* uniquetrackpts', uniquetrackpts)
    console.log('  inputwaypoints', inputwaypoints)
    console.log('  duplicatewaypoints', duplicatewaypoints)
    console.log('* uniquewaypoints', uniquewaypoints)

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
    for (const file of files) {
      console.log(file)
      try {
        const data = fs.readFileSync(file, config.input.encoding)
        filesRead++
        console.log('data', data.length)
        const xmlgpx = xmlparser.parse(data)
        // console.log('xmlgpx', xmlgpx)
        await processGPX(file, xmlgpx)
      } catch (err) {
        console.error(err)
        failmessages += file + ': ' + err.message + '\r\n'
        fails++
      }
    }
    console.log('COMPLETED READING DATA')
  }
  return rv
}

/// ////////////////////////////////////////////////////////////////////////////////////
//  waypoint {
//    time: '2022-02-28T00:00:00Z',
//    name: 'Romjularia lurida',
//    '@_lat': '55.95406591571825',
//    '@_lon': '-5.68302702716408'
//  }

async function processGPX (file, xmlgpx) {
  if (!xmlgpx.gpx) {
    notgpx++
    return
  }
  try {
    if (xmlgpx.gpx.wpt) {
      if (!Array.isArray(xmlgpx.gpx.wpt)) {
        xmlgpx.gpx.wpt = [xmlgpx.gpx.wpt]
      }
      for (const waypoint of xmlgpx.gpx.wpt) {
        // console.log('waypoint', waypoint)
        inputwaypoints++
        const existing = output.gpx.wpt.find(w => w['@_lat'] === waypoint['@_lat'] && w['@_lon'] === waypoint['@_lon'] && w.time === waypoint.time && w.name === waypoint.name)
        if (existing) {
          duplicatewaypoints++
        } else {
          uniquewaypoints++
          output.gpx.wpt.push(waypoint)
        }
      }
    }
  } catch (e) {
    console.log('Exception', file, e.message)
  }
  try {
    if (xmlgpx.gpx.trk) {
      if (!Array.isArray(xmlgpx.gpx.trk)) {
        xmlgpx.gpx.trk = [xmlgpx.gpx.trk]
      }
      for (const track of xmlgpx.gpx.trk) {
        // console.log('track', track)
        inputtracks++
        let duff = false
        let trkptcount = 0
        if ('trkseg' in track) {
          const trksegs = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg]
          for (const trkseg of trksegs) {
            if ('trkpt' in trkseg) {
              if (Array.isArray(trkseg.trkpt)) trkptcount += trkseg.trkpt.length
              else trkptcount++
            } else duff = true
          }
        } else duff = true
        if (!duff) {
          // console.log('track', track)
          validtracks++
          let existingix = output.gpx.trk.findIndex(t => t.name === track.name)
          // outputTrkpts
          if (existingix !== -1 && outputTrkpts[existingix] !== trkptcount) {
            console.log('track count discrepancy', file, outputTrkpts[existingix], trkptcount)
            existingix = -1
          }
          if (existingix !== -1) {
            duplicatetracks++
          } else {
            uniquetracks++
            console.log('track OK', track.name, trkptcount)
            output.gpx.trk.push(track)
            outputTrkpts.push(trkptcount)
            uniquetrackpts += trkptcount
          }
        } else {
          emptytracks++
          console.log('Duff track', file, track.name)
          console.log('track', track)
          // process.exit()
        }
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
  if (!('outputFile' in config)) {
    const now = new Date()
    config.outputFile = now.toISOString().replaceAll(':', '-')
  }
  const outputpath = path.join(__dirname, config.outputFolder + '/' + config.outputFile + '.gpx')
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
