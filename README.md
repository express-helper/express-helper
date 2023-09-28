# expressjs-helper

This library is a utility library that runs on top of express and is lightweight, 
but supports many convenient functions for using express.

```bash
npm i expressjs-helper
```

Only [TypeScript](https://www.typescriptlang.org/) is supported.


## How to use

```typescript
// controller/TestController.ts
@RestController()
export class TestController{

    @Get("/hello")
    get(){
        return "helloWorld";
    }
}

// app.ts
const app: Express = express();
const port = 8000;

app.use(expressHelper());
app.use(expressHelperEndpoint());


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
```