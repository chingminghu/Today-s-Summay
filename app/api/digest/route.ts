import { NextRequest, NextResponse } from "next/server";
import { getDigestByDate, getLatestDigest } from "@/lib/digest";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const digest = date
      ? await getDigestByDate(date)
      : await getLatestDigest();

    if (!digest) {
      return NextResponse.json(
        {
          success: false,
          message: "No digest found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      digest: {
        ...digest,
        rawNewsJson: JSON.parse(digest.rawNewsJson),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}