import { loadPyodide } from './pyodide/pyodide.mjs';
let runtime;
self.onmessage = async (event) => {
  try {
    self.postMessage({ type: 'status', value: 'Loading Python…' });
    runtime ??= (async () => {
      return loadPyodide({
        indexURL: new URL('./pyodide/', import.meta.url).href,
      });
    })();
    const pyodide = await runtime;
    let output = '';
    pyodide.setStdout({
      batched: (value) => {
        if (output.length < 40000)
          output += value.slice(0, 40000 - output.length) + '\n';
      },
    });
    pyodide.setStderr({
      batched: (value) => {
        if (output.length < 40000)
          output += value.slice(0, 40000 - output.length) + '\n';
      },
    });
    const result = await pyodide.runPythonAsync(event.data.code);
    if (result !== undefined && result !== null)
      output += String(result) + '\n';
    if (event.data.tests) {
      const programOutput = output;
      const tests = [];
      for (const [name, code] of event.data.tests) {
        output = '';
        try {
          pyodide.globals.set('__pathfinder_test_source', code);
          const report = JSON.parse(
            await pyodide.runPythonAsync(`
def __pathfinder_report(source, namespace):
    import ast, json, operator
    operators = {
        ast.Eq: (operator.eq, ""), ast.NotEq: (operator.ne, "!= "),
        ast.Lt: (operator.lt, "< "), ast.LtE: (operator.le, "<= "),
        ast.Gt: (operator.gt, "> "), ast.GtE: (operator.ge, ">= "),
        ast.Is: (operator.is_, "is "), ast.IsNot: (operator.is_not, "is not "),
        ast.In: (lambda left, right: left in right, "in "),
        ast.NotIn: (lambda left, right: left not in right, "not in "),
    }
    tree, checks = ast.parse(source), []

    def shown(value):
        try:
            return repr(value)
        except Exception:
            return "<value could not be displayed>"

    def check(node):
        if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.And):
            return all(check(value) for value in node.values)
        expression = ast.unparse(node)
        if isinstance(node, ast.Compare) and len(node.ops) == 1:
            actual_value = eval(compile(ast.Expression(node.left), "<test>", "eval"), namespace)
            right_value = eval(compile(ast.Expression(node.comparators[0]), "<test>", "eval"), namespace)
            operation, label = operators[type(node.ops[0])]
            expected = (label + shown(right_value)) if label else shown(right_value)
            passed = bool(operation(actual_value, right_value))
        else:
            actual_value = eval(compile(ast.Expression(node), "<test>", "eval"), namespace)
            expected, passed = "True", bool(actual_value)
        checks.append({
            "expression": expression, "expected": expected,
            "actual": shown(actual_value), "passed": passed,
        })
        return passed

    passed = True
    for statement in tree.body:
        if isinstance(statement, ast.Assert):
            passed = check(statement.test)
            if not passed:
                break
        else:
            exec(compile(ast.Module([statement], type_ignores=[]), "<test>", "exec"), namespace)
    return json.dumps({"passed": passed, "checks": checks})

__pathfinder_result = __pathfinder_report(__pathfinder_test_source, globals())
del __pathfinder_report
__pathfinder_result
`),
          );
          tests.push({ name, ...report, output });
        } catch (error) {
          tests.push({
            name,
            passed: false,
            output,
            checks: [
              {
                expression: code,
                expected: 'test completes without an exception',
                actual: String(error.message || error)
                  .trim()
                  .split('\n')
                  .at(-1),
                passed: false,
              },
            ],
            detail: String(error.message || error)
              .trim()
              .split('\n')
              .slice(-1)[0],
          });
        }
      }
      self.postMessage({ type: 'tests', value: programOutput, tests });
    } else {
      self.postMessage({
        type: 'result',
        value: output || 'Program finished with no output.',
      });
    }
  } catch (error) {
    self.postMessage({ type: 'error', value: String(error.message || error) });
  }
};
