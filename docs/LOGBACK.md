# Logback
Logback is a logging framework for the Java ecosystem, designed as a successor to the 
popular Apache Log4j project.

The standard setup for structured logs using Logback,SLF4J, and Logstash.
```
dependencies {
    implementation("org.slf4j:slf4j-api:2.0.9")
    implementation("ch.qos.logback:logback-classic:1.4.14")
    implementation("ch.qos.logback:logback-core:1.4.14")
    implementation("net.logstash.logback:logstash-logback-encoder:7.4")
}
```

```xml
<configuration>
    <appender name="consoleAppender" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeCallerData>true</includeCallerData>
            <jsonGeneratorDecorator class="net.logstash.logback.decorate.PrettyPrintingJsonGeneratorDecorator"/>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="consoleAppender"/>
    </root>
</configuration>
```

```java
final Logger logger = LoggerFactory.getLogger(this.getClass());
...
var user = new User(1, "Bob", "Lee");
logger.atInfo().addKeyValue("userInfo", user).log("Get user info");
```

```json
{
  "@timestamp" : "2024-03-04T23:56:43.6714875-08:00",
  "@version" : "1",
  "logger_name" : "slogback.Main",
  "thread_name" : "main",
  "level" : "INFO",
  "level_value" : 20000,
  "userInfo" : {
    "id" : 1,
    "firstName" : "Bob",
    "lastName" : "Lee"
  },
  "caller_class_name" : "slogback.Main",
  "caller_method_name" : "main",
  "caller_file_name" : "Main.java",
  "caller_line_number" : 13
}
```

With the log output, this log should function without any additional configurations, unless you prefer 
to use the timestamp from the logs instead of CloudWatch. In that case, you have to specify `LOG_TIMESTAMP_FIELD_NAME`,
but you can use the default `LOG_TIMESTAMP_FORMAT` since the timestamp is in `ISO_8601` format. 

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
            'LOG_TIMESTAMP_FIELD_NAME': '@timestamp',
            'LOG_TIMESTAMP_FORMAT': 'ISO_8601' // You can omit this line
        },
        logRetention: logs.RetentionDays.ONE_DAY,
    })
```
