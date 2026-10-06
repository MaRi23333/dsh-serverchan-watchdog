/** CSS Modules imported by the client half resolve to their hashed class map. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
