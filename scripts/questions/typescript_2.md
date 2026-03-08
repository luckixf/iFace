---
id: ts-031
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 工厂函数]
source: 高频
---
## 题目
TypeScript 中如何实现一个类型安全的依赖注入容器？

## 答案
## 类型安全的依赖注入

```ts
type Constructor<T = any> = new (...args: any[]) => T;

class Container {
  private bindings = new Map<any, any>();

  bind<T>(token: Constructor<T> | symbol | string, factory: () => T): this {
    this.bindings.set(token, factory);
    return this;
  }

  resolve<T>(token: Constructor<T> | symbol | string): T {
    const factory = this.bindings.get(token);
    if (!factory) throw new Error(`No binding for token: ${String(token)}`);
    return factory();
  }
}

// 使用
interface Logger { log(msg: string): void; }
interface Database { query(sql: string): Promise<any[]>; }

const container = new Container();

container.bind<Logger>(Symbol('Logger'), () => ({
  log: (msg) => console.log(`[LOG] ${msg}`),
}));

class UserService {
  constructor(
    private logger: Logger,
    private db: Database
  ) {}
  async getUsers() {
    this.logger.log('Fetching users');
    return this.db.query('SELECT * FROM users');
  }
}

// reflect-metadata + 装饰器方案（NestJS 风格）
import 'reflect-metadata';

function Injectable(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('injectable', true, target);
  };
}

function Inject(token: any): ParameterDecorator {
  return (target, _, parameterIndex) => {
    const tokens = Reflect.getMetadata('inject:tokens', target) || [];
    tokens[parameterIndex] = token;
    Reflect.defineMetadata('inject:tokens', tokens, target);
  };
}
```

---
id: ts-032
module: TypeScript
difficulty: 2
tags: [TypeScript, Zod, 运行时类型验证]
source: 高频
---
## 题目
TypeScript 类型只在编译时有效，如何在运行时验证数据类型？

## 答案
## 运行时类型验证

### 问题
TypeScript 类型在编译后被完全擦除，API 响应、用户输入等外部数据无法在运行时保证类型安全。

### 方案1：Zod（推荐）
```ts
import { z } from 'zod';

// 定义 schema（同时生成 TS 类型）
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string().datetime(),
  tags: z.array(z.string()).optional(),
});

// 从 schema 推断 TypeScript 类型
type User = z.infer<typeof UserSchema>;

// 运行时验证
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  const raw = await res.json();

  // parse：失败抛异常
  const user = UserSchema.parse(raw);
  // safeParse：失败返回 { success: false, error }
  const result = UserSchema.safeParse(raw);
  if (!result.success) {
    console.error(result.error.errors);
    throw new Error('Invalid user data');
  }
  return result.data;
}
```

### 方案2：自定义类型守卫
```ts
function isUser(val: unknown): val is User {
  return (
    typeof val === 'object' && val !== null &&
    'id' in val && typeof (val as any).id === 'string' &&
    'name' in val && typeof (val as any).name === 'string'
  );
}
```

### 方案3：class-validator（NestJS 生态）
```ts
import { IsString, IsEmail, IsInt, Min, Max, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

class CreateUserDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsInt() @Min(0) @Max(150) age!: number;
}

async function validateInput(raw: unknown) {
  const dto = plainToInstance(CreateUserDto, raw);
  const errors = await validate(dto);
  if (errors.length > 0) throw new Error(errors.toString());
  return dto;
}
```

---
id: ts-033
module: TypeScript
difficulty: 1
tags: [TypeScript, 可选链, 空值合并]
source: 高频
---
## 题目
TypeScript 中可选链（?.）和空值合并（??）操作符有什么用？

## 答案
## 可选链与空值合并

### 可选链（Optional Chaining）?.
```ts
// 不用 ?.
const city = user && user.address && user.address.city;

// 用 ?.（短路求值，遇到 null/undefined 返回 undefined）
const city = user?.address?.city;

// 可选方法调用
const result = obj?.method?.();

// 可选数组访问
const item = arr?.[0];

// 深层嵌套
const zip = user?.address?.location?.zipCode;

// 与函数调用结合
callback?.('hello'); // 如果 callback 是 null/undefined 则不调用
```

### 空值合并（Nullish Coalescing）??
```ts
// ?? 只在左侧是 null 或 undefined 时才用右侧（不同于 ||）
const name = user.name ?? 'Anonymous';
const count = obj.count ?? 0;

// || 的问题：0、''、false 也会触发
const count1 = obj.count || 0;  // obj.count 为 0 时错误！
const count2 = obj.count ?? 0;  // obj.count 为 0 时正确

// 赋值简写（??=）
user.name ??= 'Anonymous'; // 只在 name 为 null/undefined 时赋值
user.count ??= 0;
```

### 组合使用
```ts
interface Config {
  server?: {
    host?: string;
    port?: number;
    ssl?: boolean;
  };
}

function getServerConfig(config: Config) {
  return {
    host: config.server?.host ?? 'localhost',
    port: config.server?.port ?? 3000,
    ssl: config.server?.ssl ?? false,
  };
}

// TypeScript 类型收窄
function processUser(user: User | null | undefined) {
  const name = user?.name ?? 'Guest';
  // name 的类型是 string（不是 string | undefined）
}
```

---
id: ts-034
module: TypeScript
difficulty: 2
tags: [TypeScript, 抽象类, 多态, 设计模式]
source: 高频
---
## 题目
TypeScript 中如何用接口和抽象类实现多态？

## 答案
## 多态实现

### 接口多态
```ts
interface Renderer {
  render(content: string): string;
  renderList(items: string[]): string;
}

class HtmlRenderer implements Renderer {
  render(content: string) { return `<p>${content}</p>`; }
  renderList(items: string[]) {
    return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }
}

class MarkdownRenderer implements Renderer {
  render(content: string) { return content; }
  renderList(items: string[]) {
    return items.map(i => `- ${i}`).join('\n');
  }
}

class JsonRenderer implements Renderer {
  render(content: string) { return JSON.stringify({ content }); }
  renderList(items: string[]) { return JSON.stringify(items); }
}

// 多态调用
function renderPage(renderer: Renderer, data: string[]) {
  console.log(renderer.renderList(data));
}

renderPage(new HtmlRenderer(), ['a', 'b', 'c']);
renderPage(new MarkdownRenderer(), ['a', 'b', 'c']);
```

### 抽象类多态（模板方法模式）
```ts
abstract class DataExporter {
  // 模板方法（固定流程）
  async export(data: unknown[]): Promise<string> {
    const validated = await this.validate(data);
    const transformed = this.transform(validated);
    const output = this.serialize(transformed);
    await this.save(output);
    return output;
  }

  // 钩子方法（可重写）
  protected async validate(data: unknown[]): Promise<unknown[]> {
    return data.filter(Boolean);
  }

  // 抽象方法（必须实现）
  protected abstract transform(data: unknown[]): any[];
  protected abstract serialize(data: any[]): string;
  protected abstract save(output: string): Promise<void>;
}

class CsvExporter extends DataExporter {
  protected transform(data: unknown[]) {
    return data.map(row => Object.values(row as object));
  }
  protected serialize(data: any[][]) {
    return data.map(row => row.join(',')).join('\n');
  }
  protected async save(output: string) {
    await fs.writeFile('export.csv', output);
  }
}
```

---
id: ts-035
module: TypeScript
difficulty: 2
tags: [TypeScript, 类型收窄, discriminated union]
source: 高频
---
## 题目
TypeScript 可辨识联合（Discriminated Union）的最佳实践是什么？

## 答案
## 可辨识联合最佳实践

### 基础结构
```ts
// 每个成员有共同的字面量字段作为"标签"
type Shape =
  | { kind: 'circle';   radius: number }
  | { kind: 'rect';     width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':   return Math.PI * shape.radius ** 2;
    case 'rect':     return shape.width * shape.height;
    case 'triangle': return (shape.base * shape.height) / 2;
    // TypeScript 会提示未处理的 case
  }
}
```

### 穷举检查（Exhaustive Check）
```ts
// 确保所有 case 都被处理
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':   return Math.PI * shape.radius ** 2;
    case 'rect':     return shape.width * shape.height;
    case 'triangle': return (shape.base * shape.height) / 2;
    default:         return assertNever(shape); // 如果漏了某个 case，编译报错
  }
}

// 新增类型时，所有 switch 都会自动报错，不会遗漏
type Shape = ... | { kind: 'pentagon'; sides: number[] };
// 上面的 area 函数立刻报错：pentagon 未处理 ✅
```

### Action Pattern（Redux 风格）
```ts
type Action =
  | { type: 'INCREMENT'; payload?: number }
  | { type: 'DECREMENT'; payload?: number }
  | { type: 'RESET' }
  | { type: 'SET'; payload: number };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'INCREMENT': return state + (action.payload ?? 1);
    case 'DECREMENT': return state - (action.payload ?? 1);
    case 'RESET':     return 0;
    case 'SET':       return action.payload;
    default:          return assertNever(action);
  }
}
```

### 结合 Result 类型
```ts
type ApiResult<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; code: number; message: string };

function render<T>(result: ApiResult<T>) {
  switch (result.status) {
    case 'loading': return <Spinner />;
    case 'success': return <DataView data={result.data} />;
    case 'error':   return <ErrorView message={result.message} />;
  }
}
```

---
id: ts-036
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型编程, Permutation]
source: 字节跳动
---
## 题目
实现 TypeScript 工具类型 Permutation（排列组合），将联合类型转为所有排列的元组。

## 答案
## Permutation 实现

```ts
// 核心思路：对联合类型每个成员，取出一个，对剩余成员递归
type Permutation<T, K = T> =
  [T] extends [never]
    ? []
    : K extends K
      ? [K, ...Permutation<Exclude<T, K>>]
      : never;

type P = Permutation<'a' | 'b' | 'c'>;
// ["a", "b", "c"] | ["a", "c", "b"] | ["b", "a", "c"] |
// ["b", "c", "a"] | ["c", "a", "b"] | ["c", "b", "a"]

// 解析：
// 1. [T] extends [never]：使用元组包裹防止分发，处理 never
// 2. K extends K：触发联合类型分发（K 和 T 相同，分发 K）
// 3. [K, ...Permutation<Exclude<T, K>>]：当前选 K，剩余递归
```

### 相关工具类型练习

```ts
// 联合类型转元组（顺序不确定，利用 UnionToIntersection）
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

type LastOf<T> =
  UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

type UnionToTuple<T, L = LastOf<T>, N = [T] extends [never] ? true : false> =
  true extends N ? [] : [...UnionToTuple<Exclude<T, L>>, L];

type T = UnionToTuple<'a' | 'b' | 'c'>; // ["a", "b", "c"]（顺序由 TS 内部决定）

// Combination：从元组中选 K 个的组合
type Combination<T extends string, U extends string = T> =
  T extends T
    ? T | `${T} ${Combination<Exclude<U, T>>}`
    : never;

type C = Combination<'a' | 'b' | 'c'>;
// "a" | "b" | "c" | "a b" | "a c" | "b a" | "b c" | "c a" | "c b" | ...
```

---
id: ts-037
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 柯里化]
source: 高频
---
## 题目
TypeScript 如何为柯里化（Currying）函数提供类型支持？

## 答案
## TypeScript 柯里化类型

### 简单柯里化
```ts
// 手动类型
function add(a: number): (b: number) => number {
  return (b) => a + b;
}

const add5 = add(5);
const result = add5(3); // 8，类型是 number
```

### 泛型柯里化
```ts
// 两参数柯里化
function curry<A, B, R>(fn: (a: A, b: B) => R): (a: A) => (b: B) => R {
  return (a) => (b) => fn(a, b);
}

const curriedAdd = curry((a: number, b: number) => a + b);
// curriedAdd: (a: number) => (b: number) => number

const add10 = curriedAdd(10);
add10(5); // 15
```

### 多参数泛型柯里化（高级）
```ts
// 递归类型实现任意参数柯里化
type Curry<Params extends any[], Return> =
  Params extends [infer First, ...infer Rest]
    ? Rest extends []
      ? (arg: First) => Return
      : (arg: First) => Curry<Rest, Return>
    : Return;

function curryN<P extends any[], R>(fn: (...args: P) => R): Curry<P, R> {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args as P);
    }
    return (...moreArgs: any[]) => curried(...args, ...moreArgs);
  } as any;
}

// 使用
const sum = curryN((a: number, b: number, c: number) => a + b + c);
sum(1)(2)(3);     // 6
sum(1, 2)(3);     // 6（支持部分应用）
sum(1)(2, 3);     // 6
```

### Partial Application
```ts
type PartialApplication<F extends (...args: any) => any, A extends any[]> =
  F extends (...args: [...A, ...infer Rest]) => infer R
    ? (...args: Rest) => R
    : never;

function partial<F extends (...args: any) => any, A extends any[]>(
  fn: F,
  ...partialArgs: A
): PartialApplication<F, A> {
  return ((...remainingArgs: any[]) => fn(...partialArgs, ...remainingArgs)) as any;
}

const add3 = (a: number, b: number, c: number) => a + b + c;
const add1And2 = partial(add3, 1, 2); // (c: number) => number
add1And2(3); // 6
```

---
id: ts-038
module: TypeScript
difficulty: 2
tags: [TypeScript, 工具类型, 实战]
source: 高频
---
## 题目
TypeScript 中 Awaited、NoInfer 等较新的工具类型是什么？

## 答案
## 较新的 TypeScript 工具类型

### Awaited<T>（TS 4.5+）
```ts
// 递归展开 Promise 类型
type A = Awaited<Promise<string>>;              // string
type B = Awaited<Promise<Promise<number>>>;     // number
type C = Awaited<string | Promise<number>>;     // string | number

// 实际使用
async function fetchData(): Promise<User[]> { ... }
type Data = Awaited<ReturnType<typeof fetchData>>; // User[]
```

### NoInfer<T>（TS 5.4+）
```ts
// 阻止 TS 在该位置推断类型，强制从其他位置推断
function createState<T>(initial: T, fallback: NoInfer<T>): T {
  return initial ?? fallback;
}

createState({ name: 'Alice' }, { name: 'Bob' }); // T 从 initial 推断
// createState({ name: 'Alice' }, { age: 30 }); // ❌ 报错，fallback 类型不匹配
```

### ThisType<T>（TS 2.3+）
```ts
// 指定对象方法中 this 的类型
type ObjectDescriptor<D, M> = {
  data?: D;
  methods?: M & ThisType<D & M>;
};

function makeObject<D, M>(desc: ObjectDescriptor<D, M>): D & M {
  const data = desc.data || {} as D;
  const methods = desc.methods || {} as M;
  return { ...data, ...methods };
}

const obj = makeObject({
  data: { x: 0, y: 0 },
  methods: {
    moveBy(dx: number, dy: number) {
      this.x += dx; // this 的类型是 { x: number; y: number } & Methods
      this.y += dy;
    }
  }
});
```

### ConstructorParameters<T> 和 OmitThisParameter<T>
```ts
class Point {
  constructor(public x: number, public y: number) {}
}

type PointArgs = ConstructorParameters<typeof Point>; // [x: number, y: number]

function createInstance<T extends new (...args: any) => any>(
  Cls: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new Cls(...args);
}

const p = createInstance(Point, 1, 2); // Point，类型安全
```

---
id: ts-039
module: TypeScript
difficulty: 1
tags: [TypeScript, 类型兼容, 结构类型]
source: 高频
---
## 题目
TypeScript 的类型系统是结构类型（Structural Typing）还是名义类型（Nominal Typing）？

## 答案
## 结构类型 vs 名义类型

### TypeScript 使用结构类型系统
```ts
// 结构类型：只要形状（结构）兼容，就认为类型兼容，不管名字
interface Point2D { x: number; y: number; }
interface Coordinate { x: number; y: number; }

const p: Point2D = { x: 1, y: 2 };
const c: Coordinate = p; // ✅ 结构相同，可以赋值

// 与 Java/C# 不同：
// Java（名义类型）：Point2D 和 Coordinate 是不同类型，即使结构相同
```

### 鸭子类型（Duck Typing）
```ts
interface Printable { print(): void; }

class Dog {
  print() { console.log('Dog'); }
  bark() { console.log('Woof'); }
}

// Dog 没有显式 implements Printable，但结构兼容
function printIt(p: Printable) { p.print(); }
printIt(new Dog()); // ✅ Dog 有 print 方法，结构兼容
```

### 额外属性检查（对象字面量例外）
```ts
interface Config { host: string; port: number; }

// 对象字面量直接赋值时有额外属性检查
const config: Config = { host: 'localhost', port: 3000, debug: true }; // ❌

// 通过变量赋值则没有额外检查（结构类型）
const raw = { host: 'localhost', port: 3000, debug: true };
const config2: Config = raw; // ✅
```

### 模拟名义类型
```ts
// 利用品牌类型（Branded Types）实现名义区分
type UserId = string & { readonly _brand: 'UserId' };
type OrderId = string & { readonly _brand: 'OrderId' };

function createUserId(id: string): UserId {
  return id as UserId;
}

function getUser(id: UserId): User { ... }

const userId = createUserId('user_123');
const orderId = '123' as OrderId;

getUser(userId);  // ✅
getUser(orderId); // ❌ OrderId 不能赋给 UserId（即使都是 string）
```

---
id: ts-040
module: TypeScript
difficulty: 2
tags: [TypeScript, 模块, ESM, CommonJS]
source: 高频
---
## 题目
TypeScript 中如何处理 ESM 和 CommonJS 模块互操作？

## 答案
## ESM 与 CommonJS 互操作

### tsconfig 配置
```json
{
  "compilerOptions": {
    "module": "NodeNext",     // 支持 ESM 和 CJS
    "moduleResolution": "NodeNext",
    // 或
    "module": "ESNext",
    "moduleResolution": "bundler", // Vite/Webpack 推荐
    "esModuleInterop": true,       // 允许 default import CJS 模块
    "allowSyntheticDefaultImports": true
  }
}
```

### esModuleInterop
```ts
// 没有 esModuleInterop：CJS 模块没有 default export
import * as fs from 'fs';       // ✅
import fs from 'fs';            // ❌ 没有 default

// 开启 esModuleInterop 后
import fs from 'fs';            // ✅ 可以这样写
import { readFile } from 'fs';  // ✅ 具名导入也可以
```

### 类型声明中区分
```ts
// CJS 模块的类型声明
declare module 'some-cjs-module' {
  const value: string;
  export = value; // CJS 风格
}

// 使用时
import value = require('some-cjs-module'); // 传统方式
// 或
import value from 'some-cjs-module'; // esModuleInterop 开启后
```

### package.json exports
```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.ts",
        "default": "./dist/cjs/index.cjs"
      }
    }
  }
}
```

### 注意事项
```ts
// ESM 中导入必须带扩展名（Node ESM 要求）
import { foo } from './foo.js'; // 即使源码是 foo.ts，编译后是 .js

// 使用 verbatimModuleSyntax（TS 5.0+，推荐）
// 强制 type-only import 使用 import type
import type { User } from './types'; // 编译时擦除
import { User } from './types';      // ❌ 若 User 只是类型，报错
```

---
id: ts-041
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 类型推断, 实战]
source: 高频
---
## 题目
TypeScript 中如何实现一个类型安全的状态机（State Machine）？

## 答案
## 类型安全状态机

```ts
// 定义状态和转换
type MachineConfig<
  State extends string,
  Event extends string
> = {
  initial: State;
  states: {
    [S in State]: {
      on?: Partial<Record<Event, State>>;
      entry?: () => void;
      exit?: () => void;
    };
  };
};

class StateMachine<State extends string, Event extends string> {
  private current: State;

  constructor(private config: MachineConfig<State, Event>) {
    this.current = config.initial;
    config.states[this.current].entry?.();
  }

  send(event: Event): this {
    const stateConfig = this.config.states[this.current];
    const nextState = stateConfig.on?.[event];

    if (nextState) {
      stateConfig.exit?.();
      this.current = nextState;
      this.config.states[this.current].entry?.();
    }
    return this;
  }

  getState(): State { return this.current; }

  matches(state: State): boolean { return this.current === state; }
}

// 使用：交通灯状态机
type TrafficState = 'red' | 'green' | 'yellow';
type TrafficEvent = 'NEXT';

const trafficLight = new StateMachine<TrafficState, TrafficEvent>({
  initial: 'red',
  states: {
    red: {
      on: { NEXT: 'green' },
      entry: () => console.log('🔴 Red - Stop'),
    },
    green: {
      on: { NEXT: 'yellow' },
      entry: () => console.log('🟢 Green - Go'),
    },
    yellow: {
      on: { NEXT: 'red' },
      entry: () => console.log('🟡 Yellow - Caution'),
    },
  },
});

trafficLight.send('NEXT'); // 🟢 Green
trafficLight.send('NEXT'); // 🟡 Yellow
trafficLight.getState();   // "yellow"（类型是 TrafficState）
```

---
id: ts-042
module: TypeScript
difficulty: 1
tags: [TypeScript, 枚举替代, const对象]
source: 高频
---
## 题目
为什么有人推荐用 const 对象替代 TypeScript enum？

## 答案
## const 对象 vs enum

### enum 的问题

**1. 数字枚举的双向映射**
```ts
enum Status { Active, Inactive }

// 编译后生成：
var Status;
Status[Status["Active"] = 0] = "Active";
Status[Status["Inactive"] = 1] = "Inactive";

// 导致奇怪行为：
Status[0] // "Active"（反向映射）
Status[3] // undefined，但不报错
```

**2. const enum 与 babel/esbuild 不兼容**
```ts
const enum Fruit { Apple, Banana }
// esbuild/SWC 无法处理 const enum 跨文件使用
```

**3. 字符串枚举不支持反向映射（但没有上面的问题）**

### const 对象方案（推荐）
```ts
// 定义
const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
} as const;

// 类型：从对象值推断（自动维护）
type Status = typeof STATUS[keyof typeof STATUS];
// "active" | "inactive" | "deleted"

// 使用
function setStatus(status: Status) { ... }
setStatus(STATUS.ACTIVE);  // ✅
setStatus('active');       // ✅（字符串字面量兼容）
setStatus('unknown');      // ❌

// 优势：
// 1. 无运行时开销（普通对象）
// 2. 值可用于 JSON 序列化
// 3. 与所有构建工具兼容
// 4. 可迭代（Object.values(STATUS)）
// 5. Tree-Shaking 友好
```

### 何时仍使用 enum
```ts
// 需要数值枚举（位运算标志）时
const enum Permission {
  Read    = 1 << 0, // 1
  Write   = 1 << 1, // 2
  Execute = 1 << 2, // 4
}
const perm = Permission.Read | Permission.Write; // 3
```

---
id: ts-043
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 条件类型, 实战]
source: 高频
---
## 题目
实现 TypeScript 中的 DeepPick 工具类型，支持点路径访问。

## 答案
## DeepPick 实现

```ts
// 辅助：获取嵌套路径
type Paths<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? Prefix extends ''
          ? K | Paths<T[K], K>
          : `${Prefix}.${K}` | Paths<T[K], `${Prefix}.${K}`>
        : never;
    }[keyof T]
  : never;

// 辅助：根据路径获取类型
type PathValue<T, P extends string> =
  P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? PathValue<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

// DeepPick：根据路径数组选取
type DeepPick<T, Paths extends string> = {
  [P in Paths as P extends `${infer Key}.${string}` ? Key : P]:
    P extends `${infer Key}.${infer Rest}`
      ? Key extends keyof T
        ? DeepPick<T[Key], Rest>
        : never
      : P extends keyof T
        ? T[P]
        : never;
};

// 测试
interface User {
  id: string;
  name: string;
  address: {
    city: string;
    zip: string;
    country: { code: string; name: string };
  };
  tags: string[];
}

type Picked = DeepPick<User, 'id' | 'name' | 'address.city' | 'address.country.code'>;
// {
//   id: string;
//   name: string;
//   address: {
//     city: string;
//     country: { code: string };
//   };
// }

// 简化版（只支持两层）
type ShallowDeepPick<T, K extends string> = {
  [P in K as P extends `${infer Top}.${string}` ? Top : P]:
    P extends `${infer Top}.${infer Sub}`
      ? Top extends keyof T
        ? Sub extends keyof T[Top]
          ? { [Q in Sub]: T[Top][Q] }
          : never
        : never
      : P extends keyof T ? T[P] : never
};
```

---
id: ts-044
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型安全, 表单验证]
source: 高频
---
## 题目
如何用 TypeScript 实现一个类型安全的表单（Form）系统？

## 答案
## 类型安全表单系统

```ts
// 表单字段定义
type FieldConfig<T> = {
  initialValue: T;
  validate?: (value: T) => string | undefined;
  transform?: (value: string) => T;
};

type FormConfig<T extends Record<string, any>> = {
  [K in keyof T]: FieldConfig<T[K]>;
};

type FormErrors<T> = Partial<Record<keyof T, string>>;
type FormTouched<T> = Partial<Record<keyof T, boolean>>;

// 表单状态
interface FormState<T extends Record<string, any>> {
  values: T;
  errors: FormErrors<T>;
  touched: FormTouched<T>;
  isValid: boolean;
  isSubmitting: boolean;
}

// 表单 Hook
function useForm<T extends Record<string, any>>(config: FormConfig<T>) {
  type Keys = keyof T;

  // 初始值
  const initialValues = Object.fromEntries(
    Object.entries(config).map(([k, v]) => [k, (v as FieldConfig<any>).initialValue])
  ) as T;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<FormTouched<T>>({});

  // 验证单个字段
  function validateField(name: Keys, value: T[Keys]): string | undefined {
    return config[name].validate?.(value);
  }

  // 验证所有字段
  function validateAll(): FormErrors<T> {
    const newErrors: FormErrors<T> = {};
    for (const key of Object.keys(config) as Keys[]) {
      const error = validateField(key, values[key]);
      if (error) newErrors[key] = error;
    }
    return newErrors;
  }

  const setField = <K extends Keys>(name: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (onSubmit: (values: T) => Promise<void>) =>
    async (e: React.FormEvent) => {
      e.preventDefault();
      const allErrors = validateAll();
      setErrors(allErrors);
      if (Object.keys(allErrors).length === 0) {
        await onSubmit(values);
      }
    };

  return { values, errors, touched, setField, handleSubmit };
}

// 使用
interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

const { values, errors, setField, handleSubmit } = useForm<LoginForm>({
  email: {
    initialValue: '',
    validate: (v) => !v.includes('@') ? 'Invalid email' : undefined,
  },
  password: {
    initialValue: '',
    validate: (v) => v.length < 8 ? 'Too short' : undefined,
  },
  rememberMe: { initialValue: false },
});

setField('email', 'user@example.com'); // ✅ 类型安全
setField('email', 123);               // ❌ 类型错误
```

---
id: ts-045
module: TypeScript
difficulty: 2
tags: [TypeScript, 工程化, 配置, monorepo]
source: 高频
---
## 题目
TypeScript monorepo 项目中如何配置类型共享和项目引用（Project References）？

## 答案
## TypeScript Monorepo 配置

### 目录结构
```
monorepo/
├── tsconfig.base.json        # 共享基础配置
├── packages/
│   ├── shared/
│   │   ├── tsconfig.json
│   │   └── src/types.ts
│   ├── ui/
│   │   ├── tsconfig.json
│   │   └── src/
│   └── app/
│       ├── tsconfig.json
│       └── src/
└── package.json
```

### tsconfig.base.json（共享配置）
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### packages/shared/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

### packages/app/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@monorepo/shared": ["../shared/src"],
      "@monorepo/ui": ["../ui/src"]
    }
  },
  "references": [
    { "path": "../shared" },
    { "path": "../ui" }
  ],
  "include": ["src/**/*"]
}
```

### 根目录 tsconfig.json（构建入口）
```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/ui" },
    { "path": "./packages/app" }
  ]
}
```

### 构建命令
```bash
# 增量构建（只重新构建变化的包）
tsc --build
tsc --build --watch

# 清理
tsc --build --clean
```

### Package.json 路径映射（pnpm workspace）
```json
{
  "name": "@monorepo/app",
  "dependencies": {
    "@monorepo/shared": "workspace:*",
    "@monorepo/ui": "workspace:*"
  }
}
```

---
id: ts-046
module: TypeScript
difficulty: 2
tags: [TypeScript, 类型测试, expect-type]
source: 高频
---
## 题目
如何对 TypeScript 类型进行单元测试？

## 答案
## TypeScript 类型测试

### 方案1：tsd（Type System Definitions）
```ts
// types.test-d.ts
import { expectType, expectError, expectAssignable } from 'tsd';
import { add, getUser } from './my-module';

// 验证返回类型
expectType<number>(add(1, 2));

// 验证错误（编译时应该报错的情况）
expectError(add('1', 2)); // 传字符串应该报错

// 验证可赋值性
expectAssignable<string | number>(getUser().id);
```

### 方案2：@type-challenges/utils
```ts
import type { Equal, Expect, NotAny } from '@type-challenges/utils';

// 类型测试用例
type cases = [
  Expect<Equal<ReturnType<typeof add>, number>>,
  Expect<Equal<Parameters<typeof add>, [a: number, b: number]>>,
  Expect<NotAny<ReturnType<typeof add>>>,
];
```

### 方案3：vitest / jest 中的类型测试
```ts
// 使用 expectTypeOf（vitest 内置）
import { expectTypeOf } from 'vitest';
import { add } from './math';

test('add returns number', () => {
  expectTypeOf(add).toBeFunction();
  expectTypeOf(add).parameters.toEqualTypeOf<[number, number]>();
  expectTypeOf(add).returns.toBeNumber();
});

test('add result type', () => {
  const result = add(1, 2);
  expectTypeOf(result).toBeNumber();
});
```

### 方案4：手写断言工具
```ts
// 用于在源码中内联类型断言
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// 用法
type _ = Expect<Equal<string, string>>; // ✅ 通过
type __ = Expect<Equal<string, number>>; // ❌ 编译报错

// 确保 never
type IsNever<T> = [T] extends [never] ? true : false;
type ___ = Expect<IsNever<string & number>>; // ✅
```

---
id: ts-047
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型安全路由, 实战]
source: 高频
---
## 题目
如何用 TypeScript 实现类型安全的路由系统（类似 TanStack Router）？

## 答案
## 类型安全路由

```ts
// 路由参数提取
type ExtractParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : Path extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type P1 = ExtractParams<'/users/:id'>; // { id: string }
type P2 = ExtractParams<'/users/:id/posts/:postId'>; // { id: string; postId: string }
type P3 = ExtractParams<'/about'>; // {}

// 路由定义
type RouteDefinition = {
  [Path: string]: {
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
    component: React.ComponentType<any>;
  };
};

// 类型安全的 Link 组件
type LinkProps<
  Routes extends RouteDefinition,
  Path extends keyof Routes
> = {
  to: Path;
  params: ExtractParams<Path & string>;
  search?: Routes[Path]['search'];
};

function Link<Routes extends RouteDefinition, Path extends keyof Routes>(
  props: LinkProps<Routes, Path>
) {
  const { to, params } = props;
  // 将参数替换到路径中
  const href = (to as string).replace(
    /:(\w+)/g,
    (_, key) => (params as any)[key]
  );
  return <a href={href}>{props.children}</a>;
}

// 使用
const routes = {
  '/': { component: Home },
  '/users/:id': { component: UserPage },
  '/users/:id/posts/:postId': { component: PostPage },
} satisfies RouteDefinition;

// 完全类型安全
<Link to="/users/:id" params={{ id: '123' }} />          // ✅
<Link to="/users/:id/posts/:postId"
  params={{ id: '123', postId: '456' }} />                // ✅
<Link to="/users/:id" params={{ userId: '123' }} />       // ❌ 应该是 id
<Link to="/users/:id" params={{}} />                      // ❌ 缺少 id
```

---
id: ts-048
module: TypeScript
difficulty: 2
tags: [TypeScript, 类型, any vs unknown vs never]
source: 高频
---
## 题目
TypeScript 中 any、unknown、never 三者的区别是什么？

## 答案
## any vs unknown vs never

### any — 放弃类型检查
```ts
let a: any;
a = 1;           // ✅
a = 'hello';     // ✅
a.foo.bar.baz(); // ✅（不检查，运行时可能崩溃）
a as string;     // ✅

// any 是双向兼容的
const s: string = a; // ✅（any 可赋给任何类型）
const a2: any = s;   // ✅（任何类型可赋给 any）
```

### unknown — 类型安全的 any
```ts
let u: unknown;
u = 1;           // ✅（可以赋任何值）
u = 'hello';     // ✅

// 使用前必须收窄（不能直接操作）
u.toString();    // ❌ 编译报错！
(u as string).toUpperCase(); // ✅ 断言后可用（但不安全）

if (typeof u === 'string') {
  u.toUpperCase(); // ✅ 收窄后安全使用
}

// unknown 只能赋给 any 和 unknown
const s: string = u; // ❌
const a: any = u;    // ✅
const u2: unknown = u; // ✅
```

### never — 永不发生
```ts
// never 是所有类型的子类型
// never 类型的值可以赋给任何类型
// 但任何值（除了 never 本身）都不能赋给 never

// 使用场景1：永不返回的函数
function fail(msg: string): never {
  throw new Error(msg); // 永远不会正常返回
}

function infinite(): never {
  while (true) {} // 无限循环
}

// 使用场景2：穷举检查
function assertNever(x: never): never {
  throw new Error(`Unhandled: ${x}`);
}

// 使用场景3：过滤类型
type NonNullable<T> = T extends null | undefined ? never : T;
type A = NonNullable<string | null | undefined>; // string

// 使用场景4：Bottom type（联合中消失）
type B = string | never; // string
type C = string & never; // never
```

### 对比总结
```
特性               any        unknown    never
可接收任意值        ✅         ✅         ❌
可赋给任意类型      ✅         ❌         ✅
使用前需收窄        ❌         ✅         N/A
是否安全            ❌         ✅         N/A（不会有值）
用途               逃生舱     外部数据   穷举/永不返回
```

---
id: ts-049
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 高阶组件]
source: 高频
---
## 题目
如何为 React 高阶组件（HOC）编写正确的 TypeScript 类型？

## 答案
## HOC TypeScript 类型

### 基础 HOC 类型
```tsx
// 通用 HOC 类型模式
function withLogger<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  return function LoggedComponent(props: P) {
    useEffect(() => {
      console.log('Component rendered:', WrappedComponent.displayName);
    });
    return <WrappedComponent {...props} />;
  };
}

// 使用
const LoggedButton = withLogger(Button);
<LoggedButton label="Click me" onClick={() => {}} />; // 保留原有 Props 类型
```

### 注入额外 Props 的 HOC
```tsx
// HOC 注入某些 props，包装组件不需要提供
interface WithUserProps {
  user: User;
  isAuthenticated: boolean;
}

function withAuth<P extends WithUserProps>(
  WrappedComponent: React.ComponentType<P>
): React.FC<Omit<P, keyof WithUserProps>> {
  return function AuthComponent(props: Omit<P, keyof WithUserProps>) {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Redirect to="/login" />;
    return <WrappedComponent {...(props as P)} user={user} isAuthenticated />;
  };
}

// 使用
interface DashboardProps extends WithUserProps {
  title: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user, title }) => (
  <div>{title} - {user.name}</div>
);

const ProtectedDashboard = withAuth(Dashboard);
<ProtectedDashboard title="Dashboard" />;
// user 和 isAuthenticated 由 HOC 注入，不需要外部提供
```

### 保留 ref 的 HOC（forwardRef）
```tsx
function withBorder<T, P extends object>(
  WrappedComponent: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<T>
  >
) {
  return React.forwardRef<T, P>((props, ref) => (
    <div style={{ border: '1px solid red' }}>
      <WrappedComponent {...props} ref={ref} />
    </div>
  ));
}
```

### 组合多个 HOC
```ts
// 类型安全的 compose
function compose<R>(fn1: (a: R) => R, ...fns: Array<(a: R) => R>): (a: R) => R;
function compose(...fns: Function[]) {
  return fns.reduce((f, g) => (...args: any[]) => f(g(...args)));
}

const enhance = compose(withAuth, withLogger, withTheme);
const EnhancedComponent = enhance(MyComponent);
```

---
id: ts-050
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型编程, StringParser]
source: 字节跳动
---
## 题目
TypeScript 中如何用类型系统解析字符串（如解析 URL 查询参数类型）？

## 答案
## 字符串解析类型

### 解析 URL 查询参数
```ts
// 解析单个键值对 "key=value"
type ParseParam<S extends string> =
  S extends `${infer Key}=${infer Value}`
    ? { [K in Key]: Value }
    : never;

// 解析多个参数 "a=1&b=2&c=3"
type ParseQuery<S extends string> =
  S extends `${infer Param}&${infer Rest}`
    ? ParseParam<Param> & ParseQuery<Rest>
    : ParseParam<S>;

type Q = ParseQuery<'name=Alice&age=30&city=Beijing'>;
// { name: "Alice" } & { age: "30" } & { city: "Beijing" }

// 展开交叉类型
type Flatten<T> = { [K in keyof T]: T[K] };
type ParsedQuery = Flatten<ParseQuery<'name=Alice&age=30'>>;
// { name: "Alice"; age: "30" }
```

### 解析路由路径
```ts
// 解析路径段
type ParsePath<S extends string> =
  S extends `/${infer Segment}/${infer Rest}`
    ? [Segment, ...ParsePath<`/${Rest}`>]
    : S extends `/${infer Segment}`
      ? [Segment]
      : [];

type Segments = ParsePath<'/users/123/posts/456'>;
// ["users", "123", "posts", "456"]

// 提取动态段（:param）
type ExtractDynamic<Segs extends string[]> = {
  [K in keyof Segs]: Segs[K] extends `:${infer Param}` ? Param : never
}[number];

type Params = ExtractDynamic<ParsePath<'/users/:id/posts/:postId'>>;
// "id" | "postId"
```

### 解析 CSV 标题行
```ts
type ParseCSVHeader<S extends string> =
  S extends `${infer Col},${infer Rest}`
    ? [Col, ...ParseCSVHeader<Rest>]
    : [S];

type Headers = ParseCSVHeader<'id,name,age,email'>;
// ["id", "name", "age", "email"]

type CSVRow<Headers extends string[]> = {
  [K in Headers[number]]: string;
};

type Row = CSVRow<ParseCSVHeader<'id,name,age'>>;
// { id: string; name: string; age: string; }
```

---
id: ts-051
module: TypeScript
difficulty: 2
tags: [TypeScript, 性能, 类型检查, 实战技巧]
source: 高频
---
## 题目
TypeScript 中有哪些常用的实战技巧和最佳实践？

## 答案
## TypeScript 实战技巧

### 1. const assertions 精确类型
```ts
// 不用 as const：推断为宽泛类型
const config = { env: 'production', port: 3000 };
// config.env: string（不是 "production"）

// 用 as const：推断为字面量类型
const config = { env: 'production', port: 3000 } as const;
// config.env: "production"，config.port: 3000

// 数组用 as const 变为 readonly 元组
const ROLES = ['admin', 'user', 'guest'] as const;
type Role = typeof ROLES[number]; // "admin" | "user" | "guest"
```

### 2. 条件导入类型
```ts
// 仅类型导入（不影响运行时）
import type { User } from './types';
import type { FC } from 'react';

// inline type import（TS 4.5+）
import { type User, createUser } from './user';
```

### 3. 函数重载改善 API
```ts
// 根据参数类型返回不同类型
function createElement(tag: 'input'): HTMLInputElement;
function createElement(tag: 'canvas'): HTMLCanvasElement;
function createElement(tag: 'table'): HTMLTableElement;
function createElement(tag: string): HTMLElement {
  return document.createElement(tag);
}

const input = createElement('input'); // HTMLInputElement，不是 HTMLElement
```

### 4. Opaque / Brand Types 区分结构相同的类型
```ts
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };

type Meters = Brand<number, 'meters'>;
type Kilograms = Brand<number, 'kilograms'>;

function addMeters(a: Meters, b: Meters): Meters {
  return (a + b) as Meters;
}

const height = 1.75 as Meters;
const weight = 70 as Kilograms;

addMeters(height, height); // ✅
addMeters(height, weight); // ❌ 类型不兼容！即使都是 number
```

### 5. 利用 infer 提取嵌套类型
```ts
// 从 Promise 数组提取元素类型
type UnwrapPromiseArray<T> =
  T extends Promise<infer U>[]
    ? U
    : T extends Promise<infer U>
      ? U
      : T;

type A = UnwrapPromiseArray<Promise<string>[]>; // string
```

### 6. 安全的 Object.keys / entries
```ts
// Object.keys 返回 string[]，不精确
function safeKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

function safeEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as any;
}
```

---
id: ts-052
module: TypeScript
difficulty: 2
tags: [TypeScript, 错误类型, unknown, catch]
source: 高频
---
## 题目
TypeScript 4.0 起 catch 中的 error 变为 unknown，如何正确处理？

## 答案
## catch 中的 unknown error

### 变化背景
```ts
// TypeScript 4.0 前：error 是 any
try {
  riskyOperation();
} catch (error) {
  error.message; // ✅（any 类型，但不安全）
}

// TypeScript 4.0 后（useUnknownInCatchVariables: true）
try {
  riskyOperation();
} catch (error) {
  // error 是 unknown，必须收窄才能使用
  error.message; // ❌ 编译报错
}
```

### 正确处理方式

```ts
// 方式1：instanceof Error
try {
  riskyOperation();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);  // ✅ string
    console.error(error.stack);    // ✅ string | undefined
  } else {
    console.error('Unknown error:', error);
  }
}

// 方式2：自定义错误类型守卫
function isError(val: unknown): val is Error {
  return val instanceof Error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
  }
  return String(error);
}
```

### 自定义业务错误类
```ts
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype); // 兼容 ES5
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}

// 使用
try {
  await fetchUser(id);
} catch (error) {
  if (AppError.isAppError(error)) {
    if (error.statusCode === 404) showNotFound();
    else showError(error.message);
  } else {
    throw error; // 重新抛出未知错误
  }
}
```

---
id: ts-053
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型体操, 高级]
source: 字节跳动
---
## 题目
实现 TypeScript 工具类型：StringToUnion、ReplaceAll、CamelToSnake。

## 答案
## 字符串类型体操

### StringToUnion — 字符串转字符联合
```ts
type StringToUnion<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First | StringToUnion<Rest>
    : never;

type U = StringToUnion<'hello'>; // "h" | "e" | "l" | "o"
```

### ReplaceAll — 替换所有匹配
```ts
type ReplaceAll<
  S extends string,
  From extends string,
  To extends string
> = From extends ''
  ? S
  : S extends `${infer Head}${From}${infer Tail}`
    ? `${Head}${To}${ReplaceAll<Tail, From, To>}`
    : S;

type R = ReplaceAll<'hello world hello', 'hello', 'hi'>;
// "hi world hi"
```

### CamelToSnake — 驼峰转蛇形
```ts
type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? Head extends Lowercase<Head>  // 非字母字符（数字等）
        ? `${Head}${CamelToSnake<Tail>}`
        : `_${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Head}${CamelToSnake<Tail>}`
    : S;

type S1 = CamelToSnake<'helloWorld'>;    // "hello_world"
type S2 = CamelToSnake<'getUserById'>; // "get_user_by_id"

// SnakeToCamel
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type C = SnakeToCamel<'hello_world_foo'>; // "helloWorldFoo"
```

### KebabToCamel
```ts
type KebabToCamel<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<KebabToCamel<Tail>>}`
    : S;

type K = KebabToCamel<'my-component-name'>; // "myComponentName"
```

### Join — 元组转字符串
```ts
type Join<
  T extends string[],
  Sep extends string = ''
> = T extends []
  ? ''
  : T extends [infer Only extends string]
    ? Only
    : T extends [infer First extends string, ...infer Rest extends string[]]
      ? `${First}${Sep}${Join<Rest, Sep>}`
      : string;

type J = Join<['a', 'b', 'c'], '-'>; // "a-b-c"
```

---
id: ts-054
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, 实战, Proxy]
source: 高频
---
## 题目
如何用 TypeScript 为 JavaScript Proxy 提供类型安全的封装？

## 答案
## 类型安全的 Proxy 封装

```ts
// 类型安全的 readonly 代理
function createReadonlyProxy<T extends object>(target: T): Readonly<T> {
  return new Proxy(target, {
    get(obj, key) {
      const value = Reflect.get(obj, key);
      if (typeof value === 'object' && value !== null) {
        return createReadonlyProxy(value); // 递归只读
      }
      return value;
    },
    set() {
      throw new TypeError('Cannot set on readonly proxy');
    },
    deleteProperty() {
      throw new TypeError('Cannot delete on readonly proxy');
    },
  }) as Readonly<T>;
}

// 类型安全的响应式代理（Vue 3 风格）
type ReactiveHandler<T extends object> = {
  get<K extends keyof T>(target: T, key: K): T[K];
  set<K extends keyof T>(target: T, key: K, value: T[K]): boolean;
};

function reactive<T extends object>(target: T): T {
  const subscribers = new Map<keyof T, Set<() => void>>();

  return new Proxy(target, {
    get(obj, key: keyof T) {
      // 依赖追踪（简化）
      return obj[key];
    },
    set(obj, key: keyof T, value) {
      obj[key] = value;
      subscribers.get(key)?.forEach(fn => fn()); // 触发更新
      return true;
    },
  } as ProxyHandler<T>);
}

// 验证代理（运行时类型验证）
function validated<T extends object>(
  target: T,
  schema: { [K in keyof T]?: (value: T[K]) => boolean }
): T {
  return new Proxy(target, {
    set(obj, key: string | symbol, value) {
      const validator = schema[key as keyof T];
      if (validator && !validator(value)) {
        throw new TypeError(`Invalid value for ${String(key)}: ${value}`);
      }
      return Reflect.set(obj, key, value);
    },
  });
}

// 使用
const user = validated(
  { name: '', age: 0 },
  {
    name: (v) => typeof v === 'string' && v.length > 0,
    age: (v) => typeof v === 'number' && v >= 0 && v <= 150,
  }
);

user.name = 'Alice'; // ✅
user.age = 30;       // ✅
user.age = -1;       // ❌ 运行时抛错
```

---
id: ts-055
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型系统, 图灵完备, 有趣]
source: 字节跳动
---
## 题目
TypeScript 类型系统是图灵完备的——用类型实现一个简单的四则运算（加法）。

## 答案
## TypeScript 类型级别运算

### 利用元组长度实现加法
```ts
// 构建指定长度的元组
type BuildTuple<L extends number, T extends unknown[] = []> =
  T['length'] extends L ? T : BuildTuple<L, [...T, unknown]>;

// 加法：合并两个元组
type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]['length'];

type Sum = Add<3, 4>; // 7
type Sum2 = Add<10, 5>; // 15

// 减法（A >= B）
type Subtract<A extends number, B extends number> =
  BuildTuple<A> extends [...BuildTuple<B>, ...infer Rest]
    ? Rest['length']
    : never;

type Diff = Subtract<10, 3>; // 7
type Diff2 = Subtract<5, 5>; // 0

// 比较大小
type GreaterThan<A extends number, B extends number> =
  BuildTuple<A> extends [...BuildTuple<B>, ...infer Rest]
    ? Rest extends []
      ? false   // A === B
      : true    // A > B
    : false;    // A < B

type G = GreaterThan<5, 3>; // true
type G2 = GreaterThan<3, 5>; // false

// 乘法（递归累加）
type Multiply<
  A extends number,
  B extends number,
  Acc extends unknown[] = []
> = B extends 0
  ? Acc['length']
  : Multiply<A, Subtract<B, 1>, [...Acc, ...BuildTuple<A>]>;

type Product = Multiply<3, 4>; // 12

// 注意：受递归深度限制，大数运算会报错
// TypeScript 默认递归上限约 100 层
```

### 类型级别斐波那契（演示图灵完备性）
```ts
type Fib<N extends number> =
  N extends 0 ? 0
  : N extends 1 ? 1
  : Add<Fib<Subtract<N, 1>>, Fib<Subtract<N, 2>>>;

type F0 = Fib<0>; // 0
type F1 = Fib<1>; // 1
type F5 = Fib<5>; // 5
type F7 = Fib<7>; // 13
// 注意：递归深度有限制，较大的 N 会报错
```

### 实际应用价值
```ts
// 类型级别运算在实际中用于：
// 1. 限制数组长度
type FixedArray<T, N extends number, A extends T[] = []> =
  A['length'] extends N ? A : FixedArray<T, N, [...A, T]>;

type ThreeNumbers = FixedArray<number, 3>; // [number, number, number]
const arr: ThreeNumbers = [1, 2, 3]; // ✅
const arr2: ThreeNumbers = [1, 2];   // ❌ 长度不对

// 2. 固定长度的矩阵类型
type Matrix<T, Rows extends number, Cols extends number> =
  FixedArray<FixedArray<T, Cols>, Rows>;

type Matrix3x3 = Matrix<number, 3, 3>;
// [[number,number,number],[number,number,number],[number,number,number]]
```
