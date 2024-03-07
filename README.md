# Better Stack/Structured Logs AWS Lambda
[![MIT License](https://img.shields.io/badge/license-MIT-ff69b4.svg)](./LICENSE)
[![Build](https://github.com/TailrecIO/bslogs-aws-lambda/actions/workflows/build.yml/badge.svg)](https://github.com/TailrecIO/bslogs-aws-lambda/actions/workflows/build.yml)

AWS Lambda for managing structured logs in CloudWatch and forwarding to Better Stack.

This is a fork of [logtail-aws-lambda](https://github.com/logtail/logtail-aws-lambda), enhanced for improved compatibility with structured logs

## Problem Statements
- CloudWatch logs lack structured formatting. Mixing plain text logs with structured logs can lead to confusion, both for tools like Better Stack logs and for users who need to review the logs.
- Lambda emits logs to CloudWatch via stdout and stderr, leading to inaccurate log levels.
- Better Stack prefers snake_case formatting for field names. Converting field names to snake_case before sending to the Better Stack platform can ~~enhance compatibility~~ improve feeling, eliminating the need to modify your code.
- The official logtail-aws-lambda relies on pattern matching to identify request IDs, log levels, and date fields, which may not be universally effective.
- Implementing a log threshold can serve as a safety measure to filter out unwanted logs.
- Customization options such as field mappings should be available, allowing compatibility with various structured log libraries without requiring code modifications.

## Opinionated Approaches
- Log message, level, and timestamp will be placed at the top level of the structured logs.
- Additional log attributes will be included in the log context.
- All logs, including those produced by AWS Lambda (e.g., START, END, REPORT), will be in JSON format.
- Log attribute names will be converted to snake_case to align with Better Stack's naming convention.

## Log Level Precedence
Log levels are commonly represented as integers to facilitate easy comparison. However, different log libraries may 
have varying definitions for these levels. By default, common log levels include: trace, debug, info, warn, error, and fatal. 
Typically, the integers associated with these levels increase in severity from low to high. A higher integer indicates 
a more critical log, potentially necessitating immediate attention, such as panic or fatal logs.

It's worth noting that some systems, like Syslog (RFC5424) and npm log, employ an opposite convention where lower integer 
values correspond to higher priority levels. So, instead of relying solely on integers, which can be interpreted differently, 
we match with the level name to universally support various log libraries.

| Level            | Integer | Supported Libraries                                                           |
|------------------|---|-------------------------------------------------------------------------------|
| trace,verbose    |      -8 | Java Log4j/Logback, Go zerolog, .NET Serilog                                  |
| debug            |      -4 | Java Slf4J/Log4j/Logback, Go slog/zerolog/zap, Python structlog, .NET Serilog |
| info,information |       0 | Java Slf4j/Log4j/Logback, Go slog/zerolog/zap, Python structlog, .NET Serilog |
| warn,warning     |       4 | Java Slf4j/Log4j/Logback, Go slog/zerolog/zap, Python structlog, .NET Serilog |
| error,exception  |       8 | Java Slf4j/Log4j/Logback, Go slog/zerolog/zap, Python structlog, .NET Serilog |
| panic            |      12 | Go zerolog/zap                                                                |
| fatal,critical   |      16 | Java Slf4j/Log4j, Go zerolog/zap, Python structlog , .NET Serilog             |

**Note:**
- In Zerolog, panic has higher precedence than fatal, although in practical terms, the distinction may not be significant since fatal events typically result in application termination.
- Python's structlog supports aliases for certain log levels, such as "warn" being equivalent to "warning", "exception" to "error", and "critical" to "fatal". We provide support for these aliases by default.


## Getting Started
You can manually configure it through the AWS console by following [the tutorial provided by Better Stack.](https://betterstack.com/docs/logs/aws-cloudwatch/)

### Creating a Log Forwarder Using CDK v2
1. Download the ZIP file from here and place it either where your CDK definition is located or in any location you prefer.. 
2. Insert the following code into your CDK definition. If you are not using TypeScript, you may need to adjust the code to match your CDK language.
```typescript
    const logForwarderLambda = new lambda.Function(scope, functionName, {
        code: lambda.Code.fromAsset(`${process.env.CDK_PROJECT_HOME}/bslogs-aws-lambda.zip`),
        functionName: functionName,
        memorySize: 128,
        timeout: Duration.seconds(10),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_18_X,
        architecture: lambda.Architecture.ARM_64,
        environment: {
            'BETTER_STACK_SOURCE_TOKEN': 'xxx',
            'LOG_LEVEL_THRESHOLD': 'info',
            'LOG_FIELD_MAPPERS': 'crid->request_id,ten->tenant',
            'LOG_LIFECYCLE_STATES': 'INIT_START,REPORT',
            'LOG_CLOUDWATCH_FIELDS': 'logGroup,logStream,owner'
        },
        logRetention: logs.RetentionDays.ONE_DAY,
    })
```
3. Each Lambda function has its own CloudWatch log. Reading logs from individual log streams for hundreds of Lambda functions 
   can be costly and complex. To simplify this process and reduce costs, consider consolidating all CloudWatch logs into a single stream 
   using a subscription filter. You can utilize the following function to attach the subscription filter to your Lambda function:
```typescript
function attachLogForwarder(name: string, target: lambda.Function) {
    target.logGroup.addSubscriptionFilter(`${name}_logforwarder`, {
        destination: new logsDestinations.LambdaDestination(logForwarderLambda),
        filterPattern: logs.FilterPattern.allEvents()
    })
}
```

### Environment Variables

The only required environment variable is `BETTER_STACK_SOURCE_TOKEN`. You may need to specify additional environment 
variables if your log library uses different field names for messages or levels. Please consult the configuration guide 
for your log library [here] respecting these variables.

| Variable Name             | Description                                                                                                                                                                                                                                                                                                                                                        |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BETTER_STACK_SOURCE_TOKEN | Navigate to [Sources](https://logs.betterstack.com/team/0/sources), then click on the ellipsis (...) to reveal the available options. Select **Configure**, and you will find the source token there.                                                                                                                                                              |
| LOG_MESSAGE_FIELD_NAME    | The field name holding the log message. Common names include `message` and `msg`. Consult your structured log library documentation to determine which name it uses to store log messages. The default value is "message".                                                                                                                                         |
| LOG_LEVEL_FIELD_NAME      | The field name holding the log level. The default value is `level`. If your log library uses a different name, you should specify this variable.                                                                                                                                                                                                                   |
| LOG_TIMESTAMP_FIELD_NAME  | The field name holding the log timestamp. The default value is empty. If you don't specify this, the Cloudwatch timestamp will be used instead.                                                                                                                                                                                                                    |
| LOG_TIMESTAMP_FORMAT      | When specifying `LOG_TIMESTAMP_FIELD_NAME`, you should also indicate the format of time. Available options include `ISO_8601`, `UNIXS`, `UNIXMS`, `UNIXMICRO`, and `UNIXNANO`.                                                                                                                                                                                     |
| LOG_FIELD_MAPPERS         | You can rename fields before sending them to Better Stack. The format is `old_name1->new_name1,old_name2->new_name2,...`                                                                                                                                                                                                                                           |
| LOG_LEVEL_THRESHOLD       | The minimum log level that you want to forward to Better Stack. You can consult your log library or choose any of the levels available [here](#log-level-precedence).                                                                                                                                                                                              |
| LOG_LIFECYCLE_STATES      | AWS Lambda emits logs at various states during execution. You can choose whether to forward these logs to Better Stack and specify which states to include. State names should be specified in a comma-separated format, for example: `INIT_START,START,END,REPORT`. The default value is `REPORT`. These logs will be automatically converted to structured logs. |
| LOG_CLOUDWATCH_FIELDS     | Specify which CloudWatch information you want to include in the log context. Available options include `owner`, `logGroup`, and `logStream`. The default value is `logGroup`.                                                                                                                                                                                      |

## Configuration Guides

**Go** 
- [Zerolog](docs/ZEROLOG.md)

**Java**
- [Logback/SLF4J](docs/LOGBACK.md)

