
let messageFieldName = "message"
if (process.env.LOG_MESSAGE_FIELD_NAME) {
    messageFieldName = process.env.LOG_MESSAGE_FIELD_NAME
}

let levelFieldName = "level"
if (process.env.LOG_LEVEL_FIELD_NAME) {
    levelFieldName = process.env.LOG_LEVEL_FIELD_NAME
}

let timestampFieldName = ""
if (process.env.LOG_TIMESTAMP_FIELD_NAME) {
    timestampFieldName = process.env.LOG_TIMESTAMP_FIELD_NAME
}

// Format: old_name1->new_name1,old_name2->new_name2
// If the request_id field is named differently, you can pass that name here and it will be renamed to request_id
let fieldMappers = {}
if (process.env.LOG_FIELD_MAPPERS) {
    const pairs = process.env.LOG_FIELD_MAPPERS.split(',')
    pairs.forEach(pair => {
        const [oldName, newName] = pair.split('->').map(name => name.trim())
        fieldMappers[oldName] = newName
    })
}

let timeFormatter = function(dtStr) {
    return Date.parse(dtStr)
}

// TODO: support ISO string
const timeFormat = process.env.LOG_TIMESTAMP_FORMAT // UNIXS, UNIXMS, UNIXMICRO, UNIXNANO
switch (timeFormat) {
    case "":
    case "ISO8601":
    case "ISO_8601":
        // https://en.wikipedia.org/wiki/ISO_8601
        break
    case "UNIXS":
        timeFormatter = function(unixSeconds) {
            return new Date(unixSeconds*1000)
        }
        break
    case "UNIXMS":
        timeFormatter = function(unixMs) {
            return new Date(unixMs)
        }
        break
    case "UNIXMICRO":
        console.log("Time format: UNIXMICRO is not recommended. Use UNIXS or UNIXMS instead")
        timeFormatter = function(unixMicro) {
            return new Date(unixMicro/1000)
        }
        break
    case "UNIXNANO":
        console.log("Time format: UNIXNANO is not recommended. Use UNIXS or UNIXMS instead")
        timeFormatter = function(unixNano) {
            return new Date(unixNano/1000000)
        }
        break
    default:
        console.log(`Unknown time format: ${timeFormat}. Use the default format.`)
}

let logLevelThreshold = process.env.LOG_LEVEL_THRESHOLD
if (logLevelThreshold) {
    // normalize log level threshold value
    const logLevelPattern = /^(TRACE|VERBOSE|DEBUG|INFO(RMATION)?|WARN(ING)?|ERROR|PANIC|CRITICAL|FATAL)$/i
    const logLevelThresholdMatchArray = logLevelThreshold.match(logLevelPattern)
    if (logLevelThresholdMatchArray) {
        logLevelThreshold = logLevelThresholdMatchArray[0].toLowerCase()
    } else if (logLevelThreshold === "") {
        console.log("No log level threshold defined. Set the log level threshold to 'info'")
        logLevelThreshold = "info"
    } else {
        console.log(`Unknown log level threshold: ${logLevelThreshold}. Set the log level threshold to 'info'`)
        logLevelThreshold = "info"
    }
}

const logLevels = {
    "trace": -8,
    "verbose": -8,
    "debug": -4,
    "info": 0,
    "warn": 4,
    "warning": 4,
    "error": 8,
    "exception": 8,
    "panic": 12,
    "fatal": 16,
    "critical": 16,
}

function createLogLevelFilter(thresholdLevel) {
    return (logLevel) => logLevels[logLevel.toLowerCase()] >= logLevels[thresholdLevel]
}

let logLifecycleStates = {
    "INIT_START": false,
    "START": false,
    "END": false,
    "REPORT": true,
}
if (process.env.LOG_LIFECYCLE_STATES){
    const states = process.env.LOG_LIFECYCLE_STATES.split(",").map(state => state.trim().toUpperCase())
    for (const state of states) {
        switch (state) {
            case "INIT_START":
            case "START":
            case "END":
            case "REPORT":
                logLifecycleStates[state] = true
                break
            default:
                console.log(`Unknown log lifecycle state: ${state}`)
        }
    }
}

// add "logGroup" as default because it's one of the default materialized columns in betterstack
let cloudwatchFields = ["logGroup"] // We refer to the actual field. The log forwarder will convert to snake_case automatically.
if (process.env.LOG_CLOUDWATCH_FIELDS) {
    cloudwatchFields = []
    const fields = process.env.LOG_CLOUDWATCH_FIELDS.split(",").map(field => field.trim())
    for (const field of fields) {
        cloudwatchFields.push(field)
    }
    console.log(`Cloudwatch fields: ${fields} will be included in the log context.`)
} else {
    console.log("Cloudwatch fields are excluded from the log context.")
}

export const config = {
    "messageFieldName": messageFieldName,
    "levelFieldName": levelFieldName,
    "timestampFieldName": timestampFieldName,
    "fieldMappers": fieldMappers,
    "timeFormatter": timeFormatter, // TODO: Somehow the "time" field is not forwarded to Cloudwatch?
    "logLevelFilter": createLogLevelFilter(logLevelThreshold),
    "logLifecycleStates": logLifecycleStates,
    "cloudwatchFields": cloudwatchFields,
}

