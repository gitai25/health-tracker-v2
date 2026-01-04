import { NextRequest, NextResponse } from "next/server";
import { createSession, checkPassword, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!checkPassword(password)) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = await createSession();

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
