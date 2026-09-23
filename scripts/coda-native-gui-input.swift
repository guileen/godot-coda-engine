import AppKit
import CoreGraphics
import Foundation

let args = CommandLine.arguments
guard args.count >= 2 else { exit(2) }
let source = CGEventSource(stateID: .hidSystemState)
let environment = ProcessInfo.processInfo.environment
if let pidText = environment["CODA_GODOT_PID"] ?? environment["CODA_GODOT_PID"], let pid = Int32(pidText) {
    NSRunningApplication(processIdentifier: pid)?.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
    Thread.sleep(forTimeInterval: 0.3)
}

func key(_ keyCode: CGKeyCode, flags: CGEventFlags = []) {
    let down = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true)
    down?.flags = flags
    down?.post(tap: .cgSessionEventTap)
    Thread.sleep(forTimeInterval: 0.08)
    let up = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
    up?.flags = flags
    up?.post(tap: .cgSessionEventTap)
    Thread.sleep(forTimeInterval: 0.12)
}

func click(_ x: Double, _ y: Double) {
    let point = CGPoint(x: x, y: y)
    let move = CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
    move?.post(tap: .cgSessionEventTap)
    Thread.sleep(forTimeInterval: 0.15)
    for (type, button) in [(CGEventType.leftMouseDown, CGMouseButton.left), (CGEventType.leftMouseUp, CGMouseButton.left)] {
        let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: button)
        event?.post(tap: .cgSessionEventTap)
        Thread.sleep(forTimeInterval: 0.15)
    }
}

switch args[1] {
case "click":
    guard args.count >= 4, let x = Double(args[2]), let y = Double(args[3]) else { exit(2) }
    click(x, y)
case "type":
    guard args.count >= 3 else { exit(2) }
    let pasteboard = NSPasteboard.general
    pasteboard.clearContents()
    pasteboard.setString(args[2], forType: .string)
    key(9, flags: .maskCommand)
case "selectall": key(0, flags: .maskCommand)
case "enter": key(36)
case "escape": key(53)
case "down": key(125)
case "up": key(126)
default: exit(2)
}
