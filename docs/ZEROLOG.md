# Zerolog
Zero Allocation JSON Logger https://github.com/rs/zerolog
According to its own benchmark ☺, it's the fastest log for Go.

Zerolog is a structured log library, and you don't need to modify anything to make it work 
since the default message and level field names match with this log forwarder.

## Zerolog
Log errors with some attributes using the default configurations. 
```go
log.Error().
	Str("tenant", "tailrec").
    Dict("user", zerolog.Dict().
        Str("name", "Bob").
        Int("id", 1),
    ).
	Err(errors.New("item not found")).
	Msg("User not found")
```
This is the JSON output generated by the above code.
```json
{
  "level": "error",
  "tenant": "tailrec",
  "user": {
    "name": "Bob",
    "id": 1
  },
  "error": "item not found",
  "time": "2024-03-04T22:08:18-08:00",
  "message": "User not found"
}
```

## How to use the timestamp from logs?
The timestamps from logs are more accurate than those from CloudWatch. If your application requires 
high-precision timestamps, you should utilize the timestamp field.

**Note:** The log forwarder uses the CloudWatch timestamp by default because it works out of the box without additional configuration, and it should suffice for most applications.

You can customize the time precision and its field name as follows:
```go
import "github.com/rs/zerolog"
...
zerolog.TimeFieldFormat = zerolog.TimeFormatUnix // Use Unix Epoch Seconds  

// You can customize the time field name
zerolog.TimestampFieldName = "time" // this is the default value.
```

### Sample CDK configurations

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
            'LOG_TIMESTAMP_FIELD_NAME': 'time',
            'LOG_TIMESTAMP_FORMAT': 'UNIXS' // If you use zerolog.TimeFormatUnix
        },
        logRetention: logs.RetentionDays.ONE_DAY,
    })
```
