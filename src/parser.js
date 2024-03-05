import zlib from "zlib"
import {config} from "./config.js"

const EVENT_AWSLOGS = "awslogs"
const EVENT_UNKNOWN = "unknown"
const LAMBDA_LIFECYCLE_LOG_PATTERN = /^(START |INIT_START |END |REPORT )/

export async function parseRecords(event, context) {
  return await parseRecord(event)
}

async function parseRecord(event) {
  console.log(JSON.stringify(event))
  switch (parseType(event)) {
    case EVENT_AWSLOGS:
      return await parseAwsLogsRecords(event)
    default:
      return [{ data: { event } }]
  }
}

function parseType(event) {
  if (typeof event.awslogs?.data === "string") {
    return EVENT_AWSLOGS
  }

  return EVENT_UNKNOWN
}

function toSnakeCase(word) {
  return word.replace(/^\w|[A-Z]|\b\w/g, (match, index) => {
    return index === 0 ? match.toLowerCase() : '_'+match.toLowerCase();
  }).replace(/\s+/g, '');
}

function renameKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => renameKeys(item));
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = toSnakeCase(key);
      acc[newKey] = renameKeys(obj[key]);
      return acc;
    }, {});
  } else {
    return obj;
  }
}

function parseLambdaReport(report) {
  let attrPairs = report.split("\t")
  let context = {}
  for (let i = 1 ; i < attrPairs.length; i++){
    let pair = attrPairs[i]
    const sepIdx = pair.indexOf(": ")
    if (sepIdx !== -1) {
      context[toSnakeCase(pair.substring(0, sepIdx))] = pair.substring(sepIdx+2)
    }
  }
  return [attrPairs[0], context]
}

async function parseAwsLogsRecords(event) {
  const awsLogsData = await new Promise((resolve, reject) => {
    zlib.gunzip(Buffer.from(event.awslogs.data, "base64"), function (error, buffer) {
      if (error) {
        reject(new Error("Uncompressing event payload failed."))
      }
      resolve(JSON.parse(buffer.toString("utf8")))
    })
  });

  if (awsLogsData.messageType === "DATA_MESSAGE") {
    // console.log(JSON.stringify(awsLogsData))

    return awsLogsData.logEvents.reduce((acc, logEvent) => {
      let payload = {
        message: logEvent.message,
        data: {
          dt: new Date(logEvent.timestamp), // TODO: look into it why there is no "time" field in a structured log.
          level: logEvent.level, // will be replaced with the actual one from a structured log.
          context:  {
            "log_id": logEvent.id // Is this really useful?
          }
        },
      }
      for (const field of config.cloudwatchFields) {
        if (awsLogsData.hasOwnProperty(field)) {
          payload.data.context[toSnakeCase(field)] = awsLogsData[field]
        }
      }

      const eventMessage = logEvent.message
      const lifecycleLogMatch = eventMessage.match(LAMBDA_LIFECYCLE_LOG_PATTERN)
      if (lifecycleLogMatch) {
        const lifecycleState = lifecycleLogMatch[1].trimEnd()
        if (config.logLifecycleStates[lifecycleState]) {
          payload.data.level = "info"
          if (lifecycleState === "REPORT") {
            const [logMessage, logContext] = parseLambdaReport(eventMessage)
            payload.message = logMessage
            payload.data.level = "info"
            payload.data.context = {...payload.data.context, ...logContext}
          }
          acc.push(payload)
        }
        return acc
      } else {
        try {
          const jsonEvent = JSON.parse(eventMessage)
          if(!config.logLevelFilter(jsonEvent.level)) {
            // drop the message since the level is below the threshold
            return acc
          }
          payload.message = jsonEvent[config.messageFieldName]
          delete jsonEvent[config.messageFieldName]
          payload.data.level = jsonEvent[config.levelFieldName]
          delete jsonEvent[config.levelFieldName]
          if (config.timestampFieldName) { // if this field empty, we use cloudwatch timestamp
            const timestamp = jsonEvent[config.timestampFieldName]
            if (timestamp) {
              payload.data.dt = config.timeFormatter(timestamp)
              delete jsonEvent[config.timestampFieldName]
            } else {
              console.log(`Timestamp field is missing: ${config.timestampFieldName}`)
            }
          }
          // pass down the rest to the log context
          for (const [attrKey, attrValue] of Object.entries(jsonEvent)) {
            const mappedAttrKey = config.fieldMappers[attrKey]??attrKey
            payload.data.context[toSnakeCase(mappedAttrKey)] = renameKeys(attrValue)
          }

        } catch (e) { // not a json
          console.log(`Unable to parse JSON from ${eventMessage}`)
        }
        //We push regardless of whether the message is JSON to ensure we don't miss unexpected payloads.
        acc.push(payload)
      }
      return acc
    }, [])
  }

  return [{ message: "Unknown AWS Logs message type", data: { event } }]
}
