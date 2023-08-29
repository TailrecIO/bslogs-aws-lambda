import { Logtail } from "@logtail/node"
import { parseRecords } from "./src/parser.js"

// Set up Better Stack logger
if (!process.env.BETTER_STACK_SOURCE_TOKEN) {
  throw new Error("Better Stack source token has not been set in ENV variable BETTER_STACK_SOURCE_TOKEN.")
}
const options = {}
if (process.env.BETTER_STACK_ENTRYPOINT) {
  options.endpoint = process.env.BETTER_STACK_ENTRYPOINT
}
const logger = new Logtail(process.env.BETTER_STACK_SOURCE_TOKEN, options)

// Main entrypoint for Lambda
export async function handler(event, context) {
  console.debug("EVENT: \n" + JSON.stringify(event, null, 2))
  console.debug("CONTEXT: \n" + JSON.stringify(context, null, 2))

  await Promise.all(parseRecords(event, context).map(record => logger.log(record.message, record.level, record.context)))
}