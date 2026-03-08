---
id: ts-001
module: TypeScript
difficulty: 1
tags: [TypeScript, 类型, 基础]
source: 高频
---
## 题目
TypeScript 中有哪些基础类型？

## 答案
## TypeScript 基础类型

### 原始类型
```ts
let str: string = 'hello';
let num: number = 42;
let bool: boolean = true;
let n: null = null;
let u: undefined = undefined;
let big: bigint = 9007199254740991n;
let sym: symbol = Symbol('key');
```

### 数组与元组
```ts
// 数组
let arr1: number[] = [1, 2, 3];
let arr2: Array<string> = ['a', 'b'];

// 元组（固定长度和类型的数组）
let tuple: [string, number] = ['Alice', 30];
tuple[0]; // string
tuple[1]; // number

// 可选元素
let opt: [string, number?] = ['Alice'];

// 剩余元素
let rest: [string, ...number[]] = ['Alice', 1, 2, 3];
```

### 特殊类型
```ts
// any：放弃类型检查（尽量避免）
let a: any = 1;
a = 'hello'; // 不报错

// unknown：类型安全的 any，使用前必须类型收窄
let u: unknown = getInput();
if (typeof u === 'string') {
  u.toUpperCase(); // 收窄后才能使用
}

// never：永不发生的类型（抛异常、无限循环）
function fail(msg: string): never {
  throw new Error(msg);
}

// void：无返回值的函数
function log(msg: string): void {
  console.log(msg);
}

// object：非原始类型
let obj: object = { a: 1 };
```

### 字面量类型
```ts
let direction: 'left' | 'right' | 'up' | 'down';
let status: 200 | 404 | 500;
let flag: true; // 只能是 true
```

---
id: ts-002
module: TypeScript
difficulty: 1
tags: [TypeScript, interface, type, 区别]
source: 高频
---
## 题目
interface 和 type 有什么区别？

## 答案
## interface vs type

### 相同点
两者都可以描述对象形状，都支持扩展。

```ts
// interface
interface User {
  name: string;
  age: number;
}

// type
type User = {
  name: string;
  age: number;
};
```

### 核心区别

**1. 扩展语法不同**
```ts
// interface 用 extends
interface Animal { name: string; }
interface Dog extends Animal { breed: string; }

// type 用交叉类型 &
type Animal = { name: string; };
type Dog = Animal & { breed: string; };
```

**2. interface 可以声明合并，type 不能**
```ts
// interface 同名声明自动合并（Declaration Merging）
interface Window { myProp: string; }
interface Window { otherProp: number; }
// 合并为 { myProp: string; otherProp: number; }

// type 同名会报错
type Foo = { a: string };
type Foo = { b: number }; // Error: Duplicate identifier
```

**3. type 能表示更多形状**
```ts
// 联合类型（interface 不能）
type ID = string | number;
type Result = Success | Error;

// 元组
type Point = [number, number];

// 映射类型
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// 条件类型
type IsString<T> = T extends string ? true : false;
```

**4. interface 描述类的结构更清晰**
```ts
interface Serializable {
  serialize(): string;
  deserialize(input: string): void;
}
class Config implements Serializable { ... }
```

### 使用建议
```
公共 API / 库定义 → interface（可被用户扩展）
类型别名 / 联合 / 元组 / 工具类型 → type
日常开发两者皆可，团队保持一致即可
```

---
id: ts-003
module: TypeScript
difficulty: 1
tags: [TypeScript, 泛型, Generic]
source: 高频
---
## 题目
什么是泛型（Generics）？为什么需要泛型？

## 答案
## 泛型（Generics）

### 概念
泛型让代码在**保持类型安全**的前提下，支持多种类型，避免重复代码。

### 没有泛型的问题
```ts
// 使用 any 失去类型信息
function identity(arg: any): any {
  return arg;
}
const result = identity(42); // result 是 any，不知道是 number

// 重复代码
function identityString(arg: string): string { return arg; }
function identityNumber(arg: number): number { return arg; }
```

### 泛型函数
```ts
// T 是类型参数，调用时确定
function identity<T>(arg: T): T {
  return arg;
}

const s = identity<string>('hello'); // s: string
const n = identity(42);              // 自动推断 T 为 number
```

### 泛型接口与类型
```ts
interface Box<T> {
  value: T;
  getValue(): T;
}

type Pair<T, U> = { first: T; second: U };

const pair: Pair<string, number> = { first: 'a', second: 1 };
```

### 泛型约束
```ts
// 约束 T 必须有 length 属性
function getLength<T extends { length: number }>(arg: T): number {
  return arg.length;
}

getLength('hello');     // ✅ string 有 length
getLength([1, 2, 3]);   // ✅ array 有 length
getLength(42);          // ❌ number 没有 length

// 约束 K 是 T 的键
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'Alice', age: 30 };
getProperty(user, 'name'); // string
getProperty(user, 'age');  // number
getProperty(user, 'x');    // ❌ 不存在的键
```

### 泛型默认值
```ts
interface Response<T = unknown> {
  data: T;
  status: number;
}

const res: Response = { data: null, status: 200 }; // T 默认 unknown
const res2: Response<User[]> = { data: [], status: 200 };
```

---
id: ts-004
module: TypeScript
difficulty: 1
tags: [TypeScript, 枚举, enum]
source: 高频
---
## 题目
TypeScript 中 enum（枚举）有哪些使用方式？有什么注意事项？

## 答案
## TypeScript 枚举

### 数字枚举（默认）
```ts
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right  // 3
}

Direction.Up    // 0
Direction[0]    // "Up"（反向映射）

// 自定义起始值
enum Status {
  Active = 1,
  Inactive, // 2
  Deleted   // 3
}
```

### 字符串枚举
```ts
enum Color {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE'
}

// 字符串枚举没有反向映射
// 可读性更好，推荐使用
```

### const 枚举（性能优化）
```ts
const enum Fruit {
  Apple,
  Banana,
  Cherry
}

// 编译时直接内联值，不生成对象
const f = Fruit.Apple; // 编译为 const f = 0;
```

### 枚举 vs 联合类型
```ts
// 枚举
enum Role { Admin = 'admin', User = 'user', Guest = 'guest' }

// 联合字面量类型（更轻量，无运行时开销）
type Role = 'admin' | 'user' | 'guest';

// 两者对比
// 枚举：有命名空间、可反向映射、有运行时对象
// 联合类型：无运行时开销、更简洁、Tree Shake 友好
```

### 注意事项
```ts
// 1. 数字枚举有反向映射，字符串枚举没有
// 2. const enum 在某些 bundler 下可能有问题（esbuild/SWC 不支持）
// 3. 异构枚举（混合类型）不推荐
enum Bad {
  A = 1,
  B = 'b' // 混合，避免使用
}
```

---
id: ts-005
module: TypeScript
difficulty: 1
tags: [TypeScript, 类型断言, as, 非空断言]
source: 高频
---
## 题目
TypeScript 中类型断言（Type Assertion）有哪些方式？

## 答案
## 类型断言

### as 语法（推荐）
```ts
const input = document.getElementById('name') as HTMLInputElement;
input.value = 'hello'; // 现在知道是 HTMLInputElement

// 等价的尖括号语法（JSX 中不能用）
const input2 = <HTMLInputElement>document.getElementById('name');
```

### 非空断言操作符 !
```ts
// 告诉 TS：这个值一定不是 null/undefined
function getUser(): User | null { ... }

const user = getUser()!; // 断言非 null
user.name; // 不会报错

// 链式使用
const len = maybeString!.length;

// 注意：滥用 ! 会绕过类型检查，尽量用类型守卫
```

### 双重断言（强制转换）
```ts
// 当两种类型不相关时，先断言为 unknown/any
const x = 'hello' as unknown as number; // 强制，但不安全

// 正常情况下不要这么做
```

### 类型断言 vs 类型转换
```ts
// 类型断言：只影响编译时类型检查，运行时不做任何转换
const n = '123' as any as number;
typeof n; // 仍然是 "string"！运行时还是字符串

// 真正的值转换
const n2 = Number('123'); // 运行时转为数字
```

### satisfies 操作符（TS 4.9+）
```ts
// 既满足类型约束，又保留字面量类型推断
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Record<string, string | number[]>;

// palette.red 推断为 number[]（而不是 string | number[]）
// palette.green 推断为 string
```

---
id: ts-006
module: TypeScript
difficulty: 2
tags: [TypeScript, 工具类型, Partial, Required, Readonly, Pick, Omit]
source: 高频
---
## 题目
TypeScript 内置工具类型有哪些？分别有什么作用？

## 答案
## TypeScript 内置工具类型

### Partial<T> — 所有属性变可选
```ts
interface User { name: string; age: number; email: string; }

type PartialUser = Partial<User>;
// { name?: string; age?: number; email?: string; }

// 实现原理
type MyPartial<T> = { [K in keyof T]?: T[K] };
```

### Required<T> — 所有属性变必填
```ts
type RequiredUser = Required<PartialUser>;
// { name: string; age: number; email: string; }

type MyRequired<T> = { [K in keyof T]-?: T[K] }; // -? 删除可选
```

### Readonly<T> — 所有属性变只读
```ts
type ReadonlyUser = Readonly<User>;
// { readonly name: string; readonly age: number; ... }

const u: ReadonlyUser = { name: 'Alice', age: 30, email: 'a@b.com' };
u.name = 'Bob'; // ❌ Error
```

### Pick<T, K> — 选取指定属性
```ts
type UserPreview = Pick<User, 'name' | 'email'>;
// { name: string; email: string; }

type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
```

### Omit<T, K> — 排除指定属性
```ts
type UserWithoutEmail = Omit<User, 'email'>;
// { name: string; age: number; }

type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

### Record<K, V> — 构造对象类型
```ts
type PageMap = Record<string, string>;
// { [key: string]: string }

type RoleMap = Record<'admin' | 'user' | 'guest', string[]>;
// { admin: string[]; user: string[]; guest: string[]; }
```

### Exclude<T, U> 和 Extract<T, U>
```ts
type T = Exclude<string | number | boolean, boolean>;
// string | number

type T2 = Extract<string | number | boolean, string | boolean>;
// string | boolean
```

### NonNullable<T> — 去除 null/undefined
```ts
type T = NonNullable<string | null | undefined>;
// string
```

### ReturnType<T> 和 Parameters<T>
```ts
function add(a: number, b: number): number { return a + b; }

type R = ReturnType<typeof add>;    // number
type P = Parameters<typeof add>;   // [a: number, b: number]
```

### InstanceType<T>
```ts
class Dog { name: string = ''; bark() {} }
type DogInstance = InstanceType<typeof Dog>; // Dog
```

---
id: ts-007
module: TypeScript
difficulty: 2
tags: [TypeScript, 类型守卫, narrowing]
source: 高频
---
## 题目
什么是类型守卫（Type Guard）？有哪些实现方式？

## 答案
## 类型守卫（Type Guard）

类型守卫是在运行时检查类型，使 TypeScript 在某个分支内缩窄（narrow）类型。

### typeof 守卫
```ts
function process(val: string | number) {
  if (typeof val === 'string') {
    val.toUpperCase(); // 这里 val 是 string
  } else {
    val.toFixed(2);    // 这里 val 是 number
  }
}
```

### instanceof 守卫
```ts
class Cat { meow() {} }
class Dog { bark() {} }

function makeSound(animal: Cat | Dog) {
  if (animal instanceof Cat) {
    animal.meow(); // 这里是 Cat
  } else {
    animal.bark(); // 这里是 Dog
  }
}
```

### in 操作符守卫
```ts
interface Fish { swim(): void; }
interface Bird { fly(): void; }

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim(); // 这里是 Fish
  } else {
    animal.fly();  // 这里是 Bird
  }
}
```

### 自定义类型谓词（is）
```ts
// 返回类型为 arg is T，是自定义类型守卫
function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isUser(val: unknown): val is User {
  return typeof val === 'object' && val !== null
    && 'name' in val && 'age' in val;
}

function process(val: unknown) {
  if (isString(val)) {
    val.toUpperCase(); // val 是 string
  }
  if (isUser(val)) {
    val.name; // val 是 User
  }
}
```

### 可辨识联合（Discriminated Union）
```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default:
      // exhaustive check：确保所有分支都处理了
      const _never: never = shape;
      throw new Error(`Unknown shape: ${_never}`);
  }
}
```

### 断言函数（asserts）
```ts
function assertIsString(val: unknown): asserts val is string {
  if (typeof val !== 'string') {
    throw new Error('Not a string');
  }
}

function process(val: unknown) {
  assertIsString(val);
  val.toUpperCase(); // 执行到这里 val 一定是 string
}
```

---
id: ts-008
module: TypeScript
difficulty: 2
tags: [TypeScript, 条件类型, infer]
source: 高频
---
## 题目
什么是条件类型（Conditional Types）？infer 关键字有什么用？

## 答案
## 条件类型

### 基本语法
```ts
// T extends U ? X : Y
// 如果 T 能赋值给 U，则为 X，否则为 Y

type IsString<T> = T extends string ? true : false;
type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

### 分布式条件类型
```ts
// 当 T 是联合类型时，条件类型会分发到每个成员
type ToArray<T> = T extends any ? T[] : never;
type C = ToArray<string | number>; // string[] | number[]

// 阻止分发：用 [] 包裹
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type D = ToArrayNonDist<string | number>; // (string | number)[]
```

### infer 关键字（类型推断）
```ts
// 在条件类型中使用 infer 声明待推断的类型变量

// 推断函数返回值类型
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type R = ReturnType<(a: string) => number>; // number

// 推断函数参数类型
type FirstParam<T> = T extends (first: infer P, ...rest: any[]) => any ? P : never;
type P = FirstParam<(a: string, b: number) => void>; // string

// 推断 Promise 的值类型
type Awaited<T> = T extends Promise<infer V> ? Awaited<V> : T;
type V = Awaited<Promise<Promise<string>>>; // string

// 推断数组元素类型
type ElementType<T> = T extends (infer E)[] ? E : never;
type E = ElementType<number[]>; // number
```

### 实用示例
```ts
// 获取对象某属性的类型
type PropType<T, K extends keyof T> = T extends { [P in K]: infer V } ? V : never;

// 展开嵌套 Promise
type DeepAwaited<T> =
  T extends null | undefined ? T
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): any }
    ? F extends (value: infer V, ...args: infer _) => any
      ? DeepAwaited<V>
      : never
    : T;
```

---
id: ts-009
module: TypeScript
difficulty: 2
tags: [TypeScript, 映射类型, keyof, typeof]
source: 高频
---
## 题目
什么是映射类型（Mapped Types）？keyof 和 typeof 有什么用？

## 答案
## 映射类型与 keyof / typeof

### keyof
```ts
interface User { name: string; age: number; email: string; }

type UserKeys = keyof User; // "name" | "age" | "email"

// 结合泛型确保 key 安全
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### typeof（类型层面）
```ts
const user = { name: 'Alice', age: 30 };
type UserType = typeof user; // { name: string; age: number }

// 获取函数类型
const add = (a: number, b: number) => a + b;
type AddFn = typeof add; // (a: number, b: number) => number

// 结合 keyof
type UserKey = keyof typeof user; // "name" | "age"
```

### 映射类型基础
```ts
// 将 T 的所有属性转换
type Readonly<T> = {
  readonly [K in keyof T]: T[K];  // 加 readonly
};

type Optional<T> = {
  [K in keyof T]?: T[K];          // 加 ?
};

type Nullable<T> = {
  [K in keyof T]: T[K] | null;    // 值加 null
};
```

### 修饰符操作
```ts
// 加修饰符
type WithReadonly<T> = { +readonly [K in keyof T]+?: T[K] }; // 加 readonly 和 ?

// 去修饰符
type Mutable<T> = { -readonly [K in keyof T]: T[K] }; // 去 readonly
type Required<T> = { [K in keyof T]-?: T[K] };         // 去 ?
```

### 重映射键名（as）
```ts
// TypeScript 4.1+ 支持 as 重映射键
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number; }

// 过滤属性（映射到 never 则排除）
type FilterString<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

type StringProps = FilterString<{ name: string; age: number; email: string }>;
// { name: string; email: string; }
```

---
id: ts-010
module: TypeScript
difficulty: 2
tags: [TypeScript, 装饰器, Decorator]
source: 高频
---
## 题目
TypeScript 装饰器（Decorator）是什么？有哪些类型？

## 答案
## TypeScript 装饰器

### 启用装饰器
```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 类装饰器
```ts
// 接收构造函数作为参数
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

function log(constructor: Function) {
  console.log(`Class ${constructor.name} created`);
}

@sealed
@log
class BugReport {
  type = 'report';
  title: string;
  constructor(t: string) { this.title = t; }
}
```

### 方法装饰器
```ts
function readonly(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  descriptor.writable = false;
  return descriptor;
}

// 日志装饰器（实际场景）
function logMethod(target: any, key: string, desc: PropertyDescriptor) {
  const original = desc.value;
  desc.value = function (...args: any[]) {
    console.log(`Calling ${key} with`, args);
    const result = original.apply(this, args);
    console.log(`${key} returned`, result);
    return result;
  };
  return desc;
}

class Calculator {
  @logMethod
  add(a: number, b: number) { return a + b; }
}
```

### 属性装饰器
```ts
function format(formatString: string) {
  return function (target: any, propertyKey: string) {
    let value: string;
    Object.defineProperty(target, propertyKey, {
      get() { return `${formatString} ${value}`; },
      set(v: string) { value = v; },
    });
  };
}

class User {
  @format('Hello,')
  name: string = 'Alice';
}
// new User().name → "Hello, Alice"
```

### 参数装饰器
```ts
function required(target: any, key: string, paramIndex: number) {
  // 记录哪些参数是必填的（通常结合 reflect-metadata）
  console.log(`Parameter ${paramIndex} of ${key} is required`);
}

class Service {
  method(@required name: string) {}
}
```

### 装饰器工厂
```ts
// 返回装饰器函数，支持传参
function Component(options: { selector: string; template: string }) {
  return function (constructor: Function) {
    constructor.prototype.selector = options.selector;
    constructor.prototype.template = options.template;
  };
}

@Component({ selector: 'app-root', template: '<div>Hello</div>' })
class AppComponent {}
```

---
id: ts-011
module: TypeScript
difficulty: 2
tags: [TypeScript, tsconfig, 配置]
source: 高频
---
## 题目
tsconfig.json 中有哪些重要配置项？

## 答案
## tsconfig.json 重要配置

### 基础配置
```json
{
  "compilerOptions": {
    // 编译目标（输出的 JS 版本）
    "target": "ES2020",

    // 模块系统
    "module": "ESNext",          // 输出模块格式
    "moduleResolution": "bundler", // 模块解析策略（TS 5.0+）

    // 输出目录
    "outDir": "./dist",
    "rootDir": "./src",

    // 源码映射（调试用）
    "sourceMap": true,
    "declaration": true,         // 生成 .d.ts 类型声明文件
    "declarationMap": true
  }
}
```

### 严格模式（强烈推荐）
```json
{
  "compilerOptions": {
    "strict": true,  // 开启所有严格检查，等于以下所有

    // 以下是 strict 包含的选项
    "strictNullChecks": true,      // null/undefined 不能赋给其他类型
    "strictFunctionTypes": true,   // 函数参数逆变检查
    "strictBindCallApply": true,   // bind/call/apply 参数类型检查
    "strictPropertyInitialization": true, // 类属性必须初始化
    "noImplicitAny": true,         // 禁止隐式 any
    "noImplicitThis": true,        // 禁止隐式 this
    "alwaysStrict": true           // 输出文件使用 strict mode
  }
}
```

### 路径别名
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

### 额外有用配置
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,        // 禁止未使用的局部变量
    "noUnusedParameters": true,    // 禁止未使用的函数参数
    "noImplicitReturns": true,     // 所有代码路径必须有返回值
    "noFallthroughCasesInSwitch": true, // switch 必须有 break
    "exactOptionalPropertyTypes": true, // 可选属性不能赋 undefined
    "isolatedModules": true,       // 每个文件独立编译（Babel/esbuild 要求）
    "skipLibCheck": true,          // 跳过 node_modules 的类型检查（加速）
    "esModuleInterop": true,       // 允许 import React from 'react'
    "allowSyntheticDefaultImports": true,
    "jsx": "react-jsx",            // React 17+ JSX 转换
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---
id: ts-012
module: TypeScript
difficulty: 2
tags: [TypeScript, React, 组件类型]
source: 高频
---
## 题目
TypeScript 与 React 结合时，如何正确定义组件 Props 和常用类型？

## 答案
## TypeScript + React 常用类型

### 函数组件 Props
```tsx
// 方式1：interface（推荐）
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false, variant = 'primary' }) => {
  return <button onClick={onClick} disabled={disabled} className={variant}>{label}</button>;
};

// 方式2：直接解构（不用 React.FC，推荐）
function Button({ label, onClick, disabled = false }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
```

### 事件类型
```tsx
// 常见事件类型
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {};
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {};
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {};
```

### Ref 类型
```tsx
const inputRef = useRef<HTMLInputElement>(null);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

// 使用
inputRef.current?.focus();
```

### children 类型
```tsx
// React.ReactNode：最宽泛（包含 string/number/element/array/null 等）
interface Props { children: React.ReactNode; }

// React.ReactElement：只接受 JSX 元素
interface Props { children: React.ReactElement; }

// JSX.Element：等同于 React.ReactElement
```

### 泛型组件
```tsx
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// 使用
<List<User>
  items={users}
  renderItem={u => <span>{u.name}</span>}
  keyExtractor={u => u.id}
/>
```

### useState / useReducer 类型
```tsx
// useState 自动推断
const [count, setCount] = useState(0); // number
const [user, setUser] = useState<User | null>(null); // 需显式指定

// useReducer
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset'; payload: number };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment': return state + 1;
    case 'decrement': return state - 1;
    case 'reset': return action.payload;
  }
}

const [count, dispatch] = useReducer(reducer, 0);
dispatch({ type: 'reset', payload: 10 });
```

---
id: ts-013
module: TypeScript
difficulty: 2
tags: [TypeScript, 函数重载, overload]
source: 高频
---
## 题目
TypeScript 函数重载（Overload）是什么？如何使用？

## 答案
## 函数重载

### 概念
函数重载允许同一个函数根据不同的参数类型/数量表现出不同的行为，同时保留类型安全。

### 基本语法
```ts
// 重载签名（只声明，不实现）
function format(value: string): string;
function format(value: number, decimals?: number): string;
function format(value: Date): string;

// 实现签名（必须兼容所有重载）
function format(value: string | number | Date, decimals = 2): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value.toFixed(decimals);
  return value.toLocaleDateString();
}

// 调用时根据参数类型推断
const s = format('hello');         // string
const n = format(3.14159, 2);      // string
const d = format(new Date());      // string
```

### 接口中的重载
```ts
interface StringArray {
  (index: number): string;
  (index: string): number;
}
```

### 类方法重载
```ts
class Dom {
  on(event: 'click', handler: (e: MouseEvent) => void): this;
  on(event: 'keydown', handler: (e: KeyboardEvent) => void): this;
  on(event: string, handler: (e: Event) => void): this {
    document.addEventListener(event, handler);
    return this;
  }
}
```

### 使用注意
```ts
// 重载签名的顺序很重要：更具体的放前面
function process(x: string): string;        // 具体
function process(x: string | null): string; // 宽泛（放后面）
function process(x: string | null): string {
  return x ?? '';
}
```

---
id: ts-014
module: TypeScript
difficulty: 2
tags: [TypeScript, 命名空间, 模块, namespace]
source: 高频
---
## 题目
TypeScript 中 namespace 和 module 有什么区别？

## 答案
## Namespace vs Module

### 模块（Module）— 现代推荐方式
```ts
// math.ts
export function add(a: number, b: number): number { return a + b; }
export function subtract(a: number, b: number): number { return a - b; }
export const PI = 3.14159;

// main.ts
import { add, PI } from './math';
import * as MathUtils from './math';

MathUtils.add(1, 2);
```

### 命名空间（Namespace）
```ts
// 用于在全局脚本或 .d.ts 中组织代码
namespace Validation {
  export interface StringValidator {
    isAcceptable(s: string): boolean;
  }

  export class LettersOnlyValidator implements StringValidator {
    isAcceptable(s: string) {
      return /^[A-Za-z]+$/.test(s);
    }
  }
}

const v = new Validation.LettersOnlyValidator();

// 嵌套命名空间
namespace App.Utils {
  export function format(s: string) { return s.trim(); }
}
App.Utils.format(' hello ');
```

### 声明合并与命名空间
```ts
// 为已有类型添加命名空间（扩展第三方库时常用）
interface jQuery {
  (selector: string): Element;
}
namespace jQuery {
  function ajax(url: string): void;
}
```

### 何时使用
```
Module（import/export）：
  - 现代项目的首选
  - 配合打包工具（Webpack/Vite）
  - Tree Shaking 友好

Namespace：
  - 老代码库（pre-module 时代）
  - 全局脚本（非模块化）
  - 编写 .d.ts 声明文件
  - 防止全局变量污染
```

---
id: ts-015
module: TypeScript
difficulty: 2
tags: [TypeScript, 声明文件, d.ts, 类型声明]
source: 高频
---
## 题目
什么是 .d.ts 声明文件？如何为第三方 JS 库编写类型声明？

## 答案
## TypeScript 声明文件

### 概念
`.d.ts` 文件只包含类型信息，不含运行时代码，告诉 TypeScript 某个模块/变量的类型。

### 为全局变量声明类型
```ts
// global.d.ts
declare const __DEV__: boolean;
declare const __VERSION__: string;

// 声明全局函数
declare function gtag(command: string, ...args: any[]): void;

// 声明全局类型
declare type ID = string | number;
```

### 为模块声明类型
```ts
// my-module.d.ts
declare module 'my-module' {
  export interface Config {
    url: string;
    timeout?: number;
  }

  export function request(config: Config): Promise<Response>;

  export default class Client {
    constructor(config: Config);
    get(path: string): Promise<any>;
    post(path: string, data: any): Promise<any>;
  }
}
```

### 为无类型 JS 文件补充声明
```ts
// 假设 legacy.js 没有类型
// legacy.d.ts
export declare function legacyMethod(input: string): number;
export declare const config: Record<string, string>;
```

### 扩展第三方类型
```ts
// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
      requestId: string;
    }
  }
}

// 扩展 Window
interface Window {
  analytics: { track(event: string): void };
  __APP_CONFIG__: { apiUrl: string };
}
```

### 模块声明的通配符
```ts
// 为 CSS/图片等资源声明类型（Vite 项目中）
declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}

declare module '*.svg' {
  import React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export { ReactComponent };
  const src: string;
  export default src;
}

declare module '*.png' { const src: string; export default src; }
declare module '*.jpg' { const src: string; export default src; }
```

---
id: ts-016
module: TypeScript
difficulty: 3
tags: [TypeScript, 高级类型, 模板字面量类型]
source: 字节跳动
---
## 题目
TypeScript 模板字面量类型（Template Literal Types）是什么？有什么实用场景？

## 答案
## 模板字面量类型

### 基础语法（TS 4.1+）
```ts
type Greeting = `Hello, ${string}`;
const g: Greeting = 'Hello, World'; // ✅
const g2: Greeting = 'Hi, World';   // ❌

// 联合类型自动组合
type Direction = 'top' | 'bottom' | 'left' | 'right';
type CSSProperty = `margin-${Direction}` | `padding-${Direction}`;
// "margin-top" | "margin-bottom" | ... | "padding-right"
```

### 内置字符串操作类型
```ts
type U = Uppercase<'hello'>;     // "HELLO"
type L = Lowercase<'HELLO'>;     // "hello"
type C = Capitalize<'hello'>;    // "Hello"
type UC = Uncapitalize<'Hello'>; // "hello"
```

### 实用场景1：事件名推导
```ts
type EventName<T extends string> = `on${Capitalize<T>}`;
type ClickHandler = EventName<'click'>;  // "onClick"

// 从对象属性生成事件处理器类型
type EventHandlers<T extends Record<string, () => void>> = {
  [K in keyof T as EventName<string & K>]: T[K];
};
```

### 实用场景2：对象路径访问
```ts
type NestedPaths<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends object
    ? `${Prefix}${string & K}` | NestedPaths<T[K], `${Prefix}${string & K}.`>
    : `${Prefix}${string & K}`;
}[keyof T];

type UserPaths = NestedPaths<{
  name: string;
  address: { city: string; zip: string };
}>;
// "name" | "address" | "address.city" | "address.zip"
```

### 实用场景3：CSS-in-JS 类型安全
```ts
type CSSUnit = 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh';
type CSSValue = `${number}${CSSUnit}` | 'auto' | 'inherit';

function css(property: string, value: CSSValue) {}
css('width', '100px');  // ✅
css('width', '100');    // ❌（缺少单位）
```

### 实用场景4：i18n 翻译键类型安全
```ts
type Translations = {
  'common.ok': string;
  'common.cancel': string;
  'user.name': string;
};

function t(key: keyof Translations): string {
  return translations[key];
}

t('common.ok');   // ✅
t('user.email');  // ❌
```

---
id: ts-017
module: TypeScript
difficulty: 3
tags: [TypeScript, 协变, 逆变, 双变]
source: 字节跳动
---
## 题目
什么是 TypeScript 中的协变（Covariance）和逆变（Contravariance）？

## 答案
## 协变与逆变

### 概念
描述类型参数在类型层级中的可替换方向。

### 协变（Covariant）—— 子类型可赋值给父类型
```ts
// 返回值类型是协变的
type Producer<T> = () => T;

type AnimalProducer = Producer<Animal>;
type DogProducer = Producer<Dog>; // Dog extends Animal

let animalProducer: AnimalProducer;
const dogProducer: DogProducer = () => new Dog();

// ✅ 可以赋值：产出 Dog 的函数，可以当作产出 Animal 的函数
animalProducer = dogProducer;
```

### 逆变（Contravariant）—— 父类型可赋值给子类型位置
```ts
// 函数参数类型是逆变的（在 strictFunctionTypes: true 时）
type Consumer<T> = (arg: T) => void;

type AnimalConsumer = Consumer<Animal>; // 接收 Animal
type DogConsumer = Consumer<Dog>;       // 接收 Dog

const animalConsumer: AnimalConsumer = (a: Animal) => a.name;
let dogConsumer: DogConsumer;

// ✅ 可以赋值：接收 Animal 的函数，能处理更多，可以当 Dog Consumer
dogConsumer = animalConsumer;

// ❌ 不可赋值：接收 Dog 的函数，不能处理所有 Animal
// animalConsumer = dogConsumer;
```

### 为什么函数参数是逆变的？
```ts
class Animal { name = ''; }
class Dog extends Animal { bark() {} }

function feedAnimal(animal: Animal) {
  console.log(animal.name); // Animal 的属性都有
}

function feedDog(dog: Dog) {
  dog.bark(); // Dog 特有的方法，Animal 没有！
}

// 如果允许 feedDog 作为 feedAnimal 的替代：
// 可能传入一只 Cat（Cat extends Animal），但 Cat 没有 bark()！
```

### 双变（Bivariant）—— 方法类型
```ts
// 方法（method）声明是双变的（既协变又逆变）
interface Processor {
  process(arg: Dog): void; // 方法写法，双变
}

// 函数属性是逆变的（strictFunctionTypes 生效）
interface Processor {
  process: (arg: Dog) => void; // 函数属性写法，逆变
}
```

### 实际影响
```ts
// 数组是协变的（这实际上不完全安全！）
const dogs: Dog[] = [new Dog()];
const animals: Animal[] = dogs; // ✅ 允许（协变）
animals.push(new Cat()); // 运行时错误！但编译时不报错

// 只读数组是安全的协变
const readonlyAnimals: ReadonlyArray<Animal> = dogs; // ✅ 安全
```

---
id: ts-018
module: TypeScript
difficulty: 3
tags: [TypeScript, 递归类型, DeepPartial, DeepReadonly]
source: 高频
---
## 题目
如何实现 TypeScript 中的递归类型？写出 DeepPartial 和 DeepReadonly。

## 答案
## 递归类型

### DeepPartial — 深层可选
```ts
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// 使用
interface Config {
  server: { host: string; port: number; ssl: boolean };
  database: { url: string; name: string };
}

type PartialConfig = DeepPartial<Config>;
// 所有嵌套属性都变为可选

const config: PartialConfig = {
  server: { host: 'localhost' } // port 和 ssl 可以省略
};
```

### DeepReadonly — 深层只读
```ts
type DeepReadonly<T> = T extends (infer E)[]
  ? ReadonlyArray<DeepReadonly<E>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

const obj: DeepReadonly<Config> = { ... };
obj.server.port = 3000; // ❌ Error: 深层也只读
```

### DeepRequired — 深层必填
```ts
type DeepRequired<T> = T extends object
  ? { [K in keyof T]-?: DeepRequired<T[K]> }
  : T;
```

### 递归类型注意事项
```ts
// TS 4.1+ 支持尾递归优化，但仍有深度限制（默认100层）
// 过深的递归会报 "Type instantiation is excessively deep" 错误

// 处理循环引用
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }; // 循环引用，TS 允许
```

### 实用工具：DeepMerge
```ts
type DeepMerge<T, U> = {
  [K in keyof T | keyof U]:
    K extends keyof T & keyof U
      ? T[K] extends object
        ? U[K] extends object
          ? DeepMerge<T[K], U[K]>
          : U[K]
        : U[K]
      : K extends keyof T
        ? T[K]
        : K extends keyof U
          ? U[K]
          : never;
};
```

---
id: ts-019
module: TypeScript
difficulty: 2
tags: [TypeScript, 类, 访问修饰符, 抽象类]
source: 高频
---
## 题目
TypeScript 类中有哪些访问修饰符？abstract 抽象类有什么用？

## 答案
## TypeScript 类特性

### 访问修饰符
```ts
class BankAccount {
  public owner: string;       // 公开（默认）
  private balance: number;    // 私有（只在类内访问）
  protected accountType: string; // 受保护（类和子类访问）
  readonly id: string;        // 只读（不可修改）

  // 构造函数简写（自动创建并赋值属性）
  constructor(
    public name: string,      // 等同于 this.name = name
    private _secret: string
  ) {
    this.id = Math.random().toString(36);
    this.owner = name;
    this.balance = 0;
    this.accountType = 'basic';
  }

  // 私有方法
  private validate(): boolean {
    return this.balance >= 0;
  }

  // getter/setter
  get amount(): number { return this.balance; }
  set amount(v: number) {
    if (v < 0) throw new Error('Cannot be negative');
    this.balance = v;
  }
}

// JS 私有字段（真正的运行时私有）
class Modern {
  #secret = 'hidden'; // 运行时也无法访问
  getSecret() { return this.#secret; }
}
```

### 抽象类
```ts
// 抽象类不能实例化，只能被继承
abstract class Shape {
  abstract area(): number;           // 抽象方法：子类必须实现
  abstract perimeter(): number;

  // 可以有普通方法
  toString(): string {
    return `Area: ${this.area()}, Perimeter: ${this.perimeter()}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area() { return Math.PI * this.radius ** 2; }
  perimeter() { return 2 * Math.PI * this.radius; }
}

class Rectangle extends Shape {
  constructor(private w: number, private h: number) { super(); }
  area() { return this.w * this.h; }
  perimeter() { return 2 * (this.w + this.h); }
}

// new Shape(); // ❌ Error
const c = new Circle(5);
console.log(c.toString()); // ✅
```

### implements 实现接口
```ts
interface Drawable { draw(): void; }
interface Resizable { resize(factor: number): void; }

// 一个类可以实现多个接口
class Widget implements Drawable, Resizable {
  draw() { console.log('Drawing widget'); }
  resize(factor: number) { console.log(`Resizing by ${factor}`); }
}
```

---
id: ts-020
module: TypeScript
difficulty: 2
tags: [TypeScript, 索引签名, 索引访问]
source: 高频
---
## 题目
TypeScript 中索引签名（Index Signature）和索引访问类型是什么？

## 答案
## 索引签名与索引访问类型

### 索引签名
```ts
// 字符串索引签名
interface StringMap {
  [key: string]: string;
}
const m: StringMap = { a: '1', b: '2' };
m['c'] = '3'; // ✅
m['d'] = 4;   // ❌ 值必须是 string

// 数字索引签名
interface NumberArray {
  [index: number]: string;
}

// 混合（数字索引的值类型必须是字符串索引值类型的子类型）
interface Mixed {
  [key: string]: string | number;
  [index: number]: string; // ✅ string 是 string|number 的子类型
  name: string; // ✅ 具名属性的值类型必须兼容索引签名
}
```

### 索引访问类型（T[K]）
```ts
interface User {
  name: string;
  age: number;
  address: { city: string; zip: string };
}

type NameType = User['name'];              // string
type AgeType = User['age'];               // number
type AddressType = User['address'];       // { city: string; zip: string }
type CityType = User['address']['city'];  // string（嵌套访问）

// 联合键访问
type NameOrAge = User['name' | 'age'];    // string | number

// 结合 keyof
type AllValues = User[keyof User];        // string | number | { city: string; zip: string }

// 数组元素类型
type Arr = string[];
type Item = Arr[number]; // string（用 number 索引数组）

const colors = ['red', 'green', 'blue'] as const;
type Color = typeof colors[number]; // "red" | "green" | "blue"
```

### 实用技巧：从对象值类型构造联合
```ts
const STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

type Status = typeof STATUS[keyof typeof STATUS];
// "pending" | "active" | "deleted"
```

---
id: ts-021
module: TypeScript
difficulty: 2
tags: [TypeScript, 联合类型, 交叉类型]
source: 高频
---
## 题目
TypeScript 联合类型（Union）和交叉类型（Intersection）的区别？

## 答案
## 联合类型 vs 交叉类型

### 联合类型（Union）—— 或
```ts
// A | B：值是 A 类型 或 B 类型之一
type StringOrNumber = string | number;
type Status = 'active' | 'inactive' | 'deleted';

function format(val: string | number): string {
  // 使用前需要类型收窄
  if (typeof val === 'string') return val.toUpperCase();
  return val.toFixed(2);
}

// 对象联合类型
type Cat = { kind: 'cat'; meow(): void };
type Dog = { kind: 'dog'; bark(): void };
type Pet = Cat | Dog;

// 联合类型只能访问共有属性
function greet(pet: Pet) {
  pet.kind; // ✅ 共有属性
  // pet.meow(); // ❌ 不确定是 Cat
}
```

### 交叉类型（Intersection）—— 且
```ts
// A & B：值同时满足 A 和 B 类型
type Serializable = { serialize(): string };
type Identifiable = { id: string };

type Record = Serializable & Identifiable;
// { serialize(): string; id: string; }

// 合并对象类型
type Combined = { a: string } & { b: number };
// { a: string; b: number; }

// 冲突时
type Conflict = { a: string } & { a: number };
// a 的类型是 string & number = never（不可能同时是两种）
```

### 联合类型的分发特性
```ts
// 条件类型对联合类型的分发
type Nullable<T> = T | null | undefined;
type Flatten<T> = T extends Array<infer E> ? E : T;

type A = Flatten<string[] | number | boolean[]>;
// string | number | boolean
// 分发：Flatten<string[]> | Flatten<number> | Flatten<boolean[]>
// = string | number | boolean
```

### 实际使用模式
```ts
// 联合：API 响应类型
type ApiResponse<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
  | { status: 'loading' };

// 交叉：混入模式
type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

type UserWithTimestamps = WithTimestamps<User>;
// User & { createdAt: Date; updatedAt: Date; }
```

---
id: ts-022
module: TypeScript
difficulty: 3
tags: [TypeScript, 类型体操, 高级]
source: 字节跳动
---
## 题目
实现 TypeScript 工具类型：Flatten、UnionToIntersection、TupleToUnion。

## 答案
## TypeScript 类型体操

### Flatten — 展开嵌套数组类型
```ts
type Flatten<T> = T extends Array<infer Item>
  ? Flatten<Item>
  : T;

type A = Flatten<number[][][]>;  // number
type B = Flatten<string[]>;      // string
type C = Flatten<number>;        // number（非数组原样返回）
```

### TupleToUnion — 元组转联合
```ts
type TupleToUnion<T extends any[]> = T[number];

type T = TupleToUnion<[string, number, boolean]>;
// string | number | boolean
```

### UnionToIntersection — 联合转交叉
```ts
// 利用逆变位置推断
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

type A = UnionToIntersection<{ a: string } | { b: number }>;
// { a: string } & { b: number }

// 原理：
// 1. 分发条件类型把联合展开
// 2. 函数参数位置（逆变位置）的推断会将多个类型合并为交叉类型
```

### TupleLength — 元组长度
```ts
type TupleLength<T extends any[]> = T['length'];

type L = TupleLength<[1, 2, 3]>; // 3（字面量类型，不是 number）
```

### LastElement — 元组最后一个元素
```ts
type Last<T extends any[]> = T extends [...infer _, infer L] ? L : never;

type L = Last<[1, 2, 3]>; // 3
```

### Equal — 判断两类型是否相等
```ts
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

type A = Equal<string, string>; // true
type B = Equal<string, number>; // false
type C = Equal<any, number>;    // false
```

### Awaited — 展开 Promise
```ts
type MyAwaited<T> =
  T extends null | undefined
    ? T
    : T extends object & { then(onfulfilled: infer F): any }
      ? F extends (value: infer V) => any
        ? MyAwaited<V>
        : never
      : T;

type A = MyAwaited<Promise<string>>;          // string
type B = MyAwaited<Promise<Promise<number>>>; // number
```

---
id: ts-023
module: TypeScript
difficulty: 2
tags: [TypeScript, 函数类型, 高阶函数]
source: 高频
---
## 题目
TypeScript 中如何正确定义函数类型？什么是函数类型兼容性？

## 答案
## 函数类型

### 函数类型定义
```ts
// 方式1：内联类型
const add: (a: number, b: number) => number = (a, b) => a + b;

// 方式2：type 别名
type MathFn = (a: number, b: number) => number;
const multiply: MathFn = (a, b) => a * b;

// 方式3：interface（可以重载）
interface Formatter {
  (value: string): string;
  (value: number, decimals: number): string;
}

// 方式4：call signature
type WithCallCount = {
  (x: number): number;
  callCount: number; // 函数属性
};
```

### 可选参数与默认值
```ts
function greet(name: string, greeting = 'Hello', title?: string): string {
  return `${greeting}, ${title ? title + ' ' : ''}${name}!`;
}
// title 是可选的，greeting 有默认值

// 剩余参数
function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}
```

### 函数类型兼容性
```ts
// 参数数量少的函数可以赋值给参数数量多的（结构子类型）
type Handler = (event: Event, extra: string) => void;
const simpleHandler: Handler = (event) => {}; // ✅ 少参数兼容

// 返回值类型：协变（子类型兼容父类型）
type GetAnimal = () => Animal;
const getDog: GetAnimal = () => new Dog(); // ✅ Dog extends Animal

// 参数类型：逆变（strictFunctionTypes 开启时）
type HandleAnimal = (a: Animal) => void;
const handleDog: HandleAnimal = (a: Animal) => {}; // ✅
// const handleDog2: HandleAnimal = (d: Dog) => d.bark(); // ❌
```

### this 类型
```ts
interface ClickHandler {
  handleClick(this: HTMLButtonElement, event: MouseEvent): void;
}

// 声明 this 类型，调用时 TS 会检查 this 的类型
function onClick(this: HTMLButtonElement, event: MouseEvent) {
  console.log(this.disabled); // this 是 HTMLButtonElement
}
button.addEventListener('click', onClick.bind(button)); // ✅
```

---
id: ts-024
module: TypeScript
difficulty: 1
tags: [TypeScript, 类型推断, 自动推断]
source: 高频
---
## 题目
TypeScript 的类型推断（Type Inference）是如何工作的？

## 答案
## 类型推断

### 基础推断
```ts
// 变量初始化推断
let x = 42;        // x: number
let s = 'hello';   // s: string
let arr = [1, 2];  // arr: number[]
let mixed = [1, 'a']; // mixed: (string | number)[]

// 函数返回值推断
function add(a: number, b: number) {
  return a + b; // 返回 number
}

// 对象字面量推断
const user = { name: 'Alice', age: 30 };
// user: { name: string; age: number }
```

### 最佳公共类型（Best Common Type）
```ts
const arr = [1, 'hello', true]; // (string | number | boolean)[]
```

### 上下文类型推断（Contextual Typing）
```ts
// 根据上下文推断参数类型
window.addEventListener('click', (e) => {
  // e 被推断为 MouseEvent（根据 'click' 事件的签名）
  e.clientX; // ✅
});

const nums = [1, 2, 3];
nums.map((n) => n.toFixed(2)); // n 推断为 number
```

### as const — 字面量推断
```ts
// 普通推断（宽泛类型）
const palette = { red: '#ff0000', blue: '#0000ff' };
// { red: string; blue: string }

// as const（窄类型，所有值变为字面量类型）
const palette2 = { red: '#ff0000', blue: '#0000ff' } as const;
// { readonly red: "#ff0000"; readonly blue: "#0000ff" }

const langs = ['ts', 'js', 'rust'] as const;
// readonly ["ts", "js", "rust"]
type Lang = typeof langs[number]; // "ts" | "js" | "rust"
```

### satisfies（TS 4.9+）
```ts
// 既验证类型，又保留精确推断
const config = {
  port: 3000,
  host: 'localhost',
} satisfies { port: number; host: string; timeout?: number };

// config.port 的类型是 3000（字面量），而不是 number
```

---
id: ts-025
module: TypeScript
difficulty: 2
tags: [TypeScript, namespace, 模块扩展, augmentation]
source: 高频
---
## 题目
TypeScript 中如何扩展第三方模块的类型（模块扩展 Module Augmentation）？

## 答案
## 模块扩展

### 扩展已有模块
```ts
// 扩展 Express 的 Request 类型
// types/express.d.ts
import { User } from './models/user';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    requestId: string;
    startTime: number;
  }
}

// 使用
app.use((req, res, next) => {
  req.user = authenticatedUser; // ✅ 有类型
  req.requestId = uuid();       // ✅
});
```

### 扩展全局类型
```ts
// global.d.ts（不需要 declare module，直接 declare global）
declare global {
  interface Window {
    analytics: {
      track(event: string, properties?: Record<string, unknown>): void;
    };
    __APP_CONFIG__: {
      apiUrl: string;
      version: string;
    };
  }

  interface Array<T> {
    // 扩展数组方法
    groupBy(key: keyof T): Record<string, T[]>;
  }
}

export {}; // 必须有，使文件成为模块
```

### 扩展枚举
```ts
// 声明枚举合并（不常用，推荐用联合类型）
enum Color { Red = 'red', Blue = 'blue' }
namespace Color {
  export const Purple = 'purple';
  export function isValid(c: string): c is Color {
    return Object.values(Color).includes(c as Color);
  }
}
```

### 扩展第三方组件库类型
```ts
// 扩展 Material UI 主题
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      drawerWidth: number;
    };
  }
  interface ThemeOptions {
    custom?: {
      drawerWidth?: number;
    };
  }
}
```

---
id: ts-026
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型约束, 条件类型, 实战]
source: 高频
---
## 题目
如何用 TypeScript 实现一个类型安全的 EventEmitter？

## 答案
## 类型安全的 EventEmitter

```ts
// 定义事件映射类型
type EventMap = Record<string, any>;

// 事件发射器接口
interface TypedEventEmitter<Events extends EventMap> {
  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
  emit<K extends keyof Events>(event: K, data: Events[K]): boolean;
  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
}

// 实现
class EventEmitter<Events extends EventMap> implements TypedEventEmitter<Events> {
  private listeners: Partial<Record<keyof Events, Function[]>> = {};

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    const arr = this.listeners[event];
    if (arr) {
      this.listeners[event] = arr.filter(l => l !== listener) as any;
    }
    return this;
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): boolean {
    const arr = this.listeners[event];
    if (!arr?.length) return false;
    arr.forEach(l => l(data));
    return true;
  }

  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    const wrapper = (data: Events[K]) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// 使用
interface AppEvents {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  error: Error;
  resize: { width: number; height: number };
}

const emitter = new EventEmitter<AppEvents>();

emitter.on('login', (data) => {
  console.log(data.userId);   // ✅ string
  console.log(data.timestamp); // ✅ number
});

emitter.emit('login', { userId: '123', timestamp: Date.now() }); // ✅
emitter.emit('login', { userId: 123 }); // ❌ userId 必须是 string
```

---
id: ts-027
module: TypeScript
difficulty: 3
tags: [TypeScript, 高级类型, Builder模式]
source: 高频
---
## 题目
如何用 TypeScript 泛型实现链式调用（Builder 模式）并保持类型安全？

## 答案
## TypeScript Builder 模式

```ts
// 累积类型的 Builder
class QueryBuilder<T extends object = {}> {
  private conditions: string[] = [];
  private selectedFields: string[] = [];

  select<K extends string>(
    ...fields: K[]
  ): QueryBuilder<T & Record<K, unknown>> {
    this.selectedFields.push(...fields);
    return this as any;
  }

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  build(): string {
    const fields = this.selectedFields.join(', ') || '*';
    const where = this.conditions.length
      ? ` WHERE ${this.conditions.join(' AND ')}`
      : '';
    return `SELECT ${fields}${where}`;
  }
}

// 使用
const query = new QueryBuilder()
  .select('name', 'age', 'email')
  .where('age > 18')
  .where('active = true')
  .build();

// 真正类型安全的 Builder（用元组累积类型）
type Expand<T> = { [K in keyof T]: T[K] };

class StrictBuilder<T extends Record<string, unknown> = {}> {
  private data: Partial<T> = {};

  set<K extends string, V>(
    key: K,
    value: V
  ): StrictBuilder<Expand<T & Record<K, V>>> {
    (this.data as any)[key] = value;
    return this as any;
  }

  build(): T {
    return this.data as T;
  }
}

const result = new StrictBuilder()
  .set('name', 'Alice')    // StrictBuilder<{ name: string }>
  .set('age', 30)          // StrictBuilder<{ name: string; age: number }>
  .set('active', true)     // StrictBuilder<{ name: string; age: number; active: boolean }>
  .build();

result.name;   // string ✅
result.age;    // number ✅
result.active; // boolean ✅
```

---
id: ts-028
module: TypeScript
difficulty: 2
tags: [TypeScript, 错误处理, Result类型]
source: 高频
---
## 题目
如何用 TypeScript 实现类型安全的错误处理（Result/Either 类型）？

## 答案
## 类型安全错误处理

### Result 类型（成功/失败二选一）
```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// 创建辅助函数
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// 使用
async function fetchUser(id: string): Promise<Result<User, string>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return err(`HTTP ${res.status}`);
    const user = await res.json();
    return ok(user);
  } catch (e) {
    return err('Network error');
  }
}

async function main() {
  const result = await fetchUser('123');
  if (result.ok) {
    console.log(result.value.name); // ✅ User
  } else {
    console.error(result.error);    // ✅ string
  }
}
```

### 链式操作（monadic）
```ts
class ResultChain<T, E> {
  constructor(private result: Result<T, E>) {}

  map<U>(fn: (value: T) => U): ResultChain<U, E> {
    if (this.result.ok) {
      return new ResultChain(ok(fn(this.result.value)));
    }
    return this as unknown as ResultChain<U, E>;
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): ResultChain<U, E> {
    if (this.result.ok) {
      return new ResultChain(fn(this.result.value));
    }
    return this as unknown as ResultChain<U, E>;
  }

  match<U>(handlers: { ok: (v: T) => U; err: (e: E) => U }): U {
    return this.result.ok
      ? handlers.ok(this.result.value)
      : handlers.err(this.result.error);
  }
}

// 使用
const output = new ResultChain(await fetchUser('123'))
  .map(user => user.name.toUpperCase())
  .map(name => `Hello, ${name}!`)
  .match({
    ok: msg => msg,
    err: e => `Error: ${e}`,
  });
```

---
id: ts-029
module: TypeScript
difficulty: 3
tags: [TypeScript, 性能, 类型检查优化]
source: 高频
---
## 题目
TypeScript 项目中有哪些常见的类型检查性能问题？如何优化？

## 答案
## TypeScript 性能优化

### 1. 避免过度复杂的类型
```ts
// 问题：递归类型层次过深
type DeepPartial<T> = T extends object ? {
  [K in keyof T]?: DeepPartial<T[K]>;
} : T;
// 对大型对象可能导致 "Type instantiation is excessively deep"

// 优化：限制递归深度
type DeepPartial<T, D extends number = 5> = [D] extends [never]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K], Prev[D]> }
    : T;
// 使用计数器限制深度
```

### 2. 使用 interface 代替 type（可合并，提升增量编译性能）
```ts
// 大型项目中 interface 的类型检查比 type 更快（可缓存）
interface User { name: string; age: number; }
// 比
type User = { name: string; age: number };
// 性能稍好（在复杂场景下）
```

### 3. skipLibCheck 和 isolatedModules
```json
{
  "compilerOptions": {
    "skipLibCheck": true,       // 不检查 node_modules 类型（大幅提速）
    "isolatedModules": true,    // 每文件独立编译（esbuild/SWC 要求）
    "incremental": true,        // 增量编译（缓存编译结果）
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 4. 拆分类型文件
```ts
// 将复杂的工具类型放到单独文件，避免污染主模块
// types/utils.ts（只被需要时导入）
export type DeepPartial<T> = ...;

// 使用 type-only import（提示编译器可安全擦除）
import type { User } from './models';
```

### 5. 避免反模式
```ts
// 避免：枚举嵌套太深
type Bad = Record<string, Record<string, Record<string, string>>>;

// 避免：大量条件类型链
type Bad2<T> = T extends A ? X : T extends B ? Y : T extends C ? Z : ...;

// 避免：对 any/unknown 大量使用条件类型
```

### 6. 项目引用（Project References）
```json
// tsconfig.json（大型 monorepo）
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ui" }
  ]
}
// 每个子包独立编译、缓存，不互相污染
```

---
id: ts-030
module: TypeScript
difficulty: 2
tags: [TypeScript, 泛型, API设计]
source: 高频
---
## 题目
如何用 TypeScript 泛型设计一个类型安全的 API 请求封装？

## 答案
## 类型安全的 API 封装

```ts
// API 路由类型映射
interface ApiRoutes {
  'GET /users': { params: never; response: User[] };
  'GET /users/:id': { params: { id: string }; response: User };
  'POST /users': { params: never; body: CreateUserDto; response: User };
  'PUT /users/:id': { params: { id: string }; body: UpdateUserDto; response: User };
  'DELETE /users/:id': { params: { id: string }; response: void };
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// 类型安全的请求函数
async function request<
  R extends keyof ApiRoutes,
  Route extends ApiRoutes[R]
>(
  route: R,
  options?: {
    params?: Route extends { params: infer P } ? P : never;
    body?: Route extends { body: infer B } ? B : never;
  }
): Promise<Route extends { response: infer Res } ? Res : never> {
  const [method, path] = (route as string).split(' ');
  // 替换路径参数
  let url = path;
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      url = url.replace(`:${k}`, String(v));
    });
  }

  const res = await fetch(url, {
    method,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 使用（完全类型安全）
const users = await request('GET /users');
// users: User[]

const user = await request('GET /users/:id', { params: { id: '123' } });
// user: User

const newUser = await request('POST /users', {
  body: { name: 'Alice', email: 'alice@example.com' },
});
// newUser: User

// 错误示例
await request('GET /users/:id'); // ❌ 缺少 params
await request('GET /users/:id', { params: { userId: '123' } }); // ❌ 应该是 id 不是 userId
```
