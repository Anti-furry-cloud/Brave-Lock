using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Reflection;
using System.Threading;

[assembly: AssemblyTitle("Brave Lock helper")]
[assembly: AssemblyDescription("Renames completed downloads with a .lock suffix. Developed by Anti-furry-cloud.")]
[assembly: AssemblyCompany("Anti-furry-cloud")]
[assembly: AssemblyProduct("Brave Lock")]
[assembly: AssemblyCopyright("Developed by Anti-furry-cloud")]
[assembly: AssemblyVersion("1.1.1.0")]
[assembly: AssemblyFileVersion("1.1.1.0")]

internal static class NativeHost {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static byte[] ReadExact(Stream input, int length) {
        byte[] buffer = new byte[length];
        int offset = 0;
        while (offset < length) {
            int count = input.Read(buffer, offset, length - offset);
            if (count == 0) throw new EndOfStreamException();
            offset += count;
        }
        return buffer;
    }
    static object Handle(Dictionary<string, object> request) {
        object action;
        if (!request.TryGetValue("action", out action)) throw new Exception("Missing action.");
        if ((string)action == "ping") return new {ok = true, version = "1.1.1"};
        if ((string)action != "lock") throw new Exception("Unsupported action.");
        object raw;
        if (!request.TryGetValue("path", out raw) || !(raw is string)) throw new Exception("Missing path.");
        string source = (string)raw;
        // Only local, absolute drive paths. No UNC, devices or alternate streams.
        if (source.Length < 3 || !Char.IsLetter(source[0]) || source[1] != ':' ||
            (source[2] != '\\' && source[2] != '/') || source.IndexOf(':', 2) >= 0)
            throw new Exception("Only absolute local file paths are supported.");
        source = Path.GetFullPath(source);
        if (!File.Exists(source)) throw new Exception("File not found.");
        for (string current = source; current != null; current = Path.GetDirectoryName(current)) {
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new Exception("Reparse points are not supported.");
        }
        if (source.EndsWith(".lock", StringComparison.OrdinalIgnoreCase))
            return new {ok = true, path = source};
        // File.Move never overwrites an existing target. Use the same directory.
        for (int n = 0; n < 10000; n++) {
            string target = source + (n == 0 ? "" : " (" + n + ")") + ".lock";
            if (TryMove(source, target)) return new {ok = true, path = target};
        }
        throw new Exception("Too many filename conflicts.");
    }
    // Antivirus scanners often hold a download open briefly after it completes.
    // Returns false when the target name is taken; retries while the source is in use.
    static bool TryMove(string source, string target) {
        for (int attempt = 1; ; attempt++) {
            try {
                File.Move(source, target);
                return true;
            } catch (IOException) {
                if (File.Exists(target)) return false;
                if (attempt == 20 || !File.Exists(source)) throw;
                Thread.Sleep(250);
            }
        }
    }
    public static void Main() {
        object response;
        try {
            Stream input = Console.OpenStandardInput();
            int length = BitConverter.ToInt32(ReadExact(input, 4), 0);
            if (length < 1 || length > 65536) throw new Exception("Invalid message size.");
            string message = Encoding.UTF8.GetString(ReadExact(input, length));
            response = Handle(Json.Deserialize<Dictionary<string, object>>(message));
        } catch (Exception ex) {
            response = new {ok = false, error = ex.Message};
        }
        byte[] body = Encoding.UTF8.GetBytes(Json.Serialize(response));
        Stream output = Console.OpenStandardOutput();
        output.Write(BitConverter.GetBytes(body.Length), 0, 4);
        output.Write(body, 0, body.Length);
        output.Flush();
    }
}
