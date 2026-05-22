using System;
using System.Reflection;

var dll = Assembly.LoadFile(@"C:\Users\vohot\.nuget\packages\payos\2.1.0\lib\net9.0\PayOS.dll");

var types = dll.GetTypes();
foreach (var t in types)
{
    if (t.FullName.Contains("PaymentRequest") || t.FullName.Contains("PaymentLink"))
        Console.WriteLine(t.FullName);
}
