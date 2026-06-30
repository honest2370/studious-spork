import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Spinner } from "@/components/ui";
import type { Order, Product } from "@/types";

interface CourseOrder extends Order {
  product: Product;
}

export default function MyCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOrder[]>([]);
  const [active, setActive] = useState<CourseOrder | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sb.from("orders")
      .select("*, product:product_id(*)")
      .eq("buyer_id", user.id).eq("status", "confirmed")
      .then(({ data }) => {
        const courseOrders = ((data as any[]) || []).filter((o) => o.product?.type === "course");
        setCourses(courseOrders);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  if (active) {
    const modules = active.product.curriculum || [];
    return (
      <div className="p-4 pb-28">
        <button onClick={() => setActive(null)} className="text-blue-600 text-sm font-semibold mb-4">← Back</button>
        <h1 className="text-xl font-extrabold text-slate-900 mb-4">{active.product.title}</h1>
        {modules.length === 0 ? (
          <p className="text-slate-400 text-center py-10">No lessons available yet</p>
        ) : modules.map((mod, mi) => (
          <div key={mi} className="mb-5">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">{mod.title}</p>
            {mod.lessons.map((lesson, li) => {
              const key = `${mi}-${li}`;
              const isOpen = openLesson === key;
              return (
                <Card key={key} className="mb-2">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpenLesson(isOpen ? null : key)}>
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">▶</div>
                    <div>
                      <p className="font-semibold text-sm">{lesson.title}</p>
                      {lesson.duration && <p className="text-xs text-slate-400">{lesson.duration}</p>}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3">
                      {lesson.video_url && <VideoEmbed url={lesson.video_url} />}
                      {lesson.notes && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{lesson.notes}</p>}
                      {lesson.attachment_url && (
                        <a href={lesson.attachment_url} target="_blank" rel="noreferrer" className="block text-center bg-slate-100 rounded-lg py-2 text-sm font-semibold text-slate-700 mt-2">
                          📎 Download attachment
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">My Courses</h1>
      {courses.length === 0 ? (
        <p className="text-center text-slate-400 py-20">No courses purchased yet.</p>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Card key={c.id} className="cursor-pointer" >
              <div onClick={() => setActive(c)} className="flex items-center gap-3">
                {c.product.cover_url && <img src={c.product.cover_url} className="w-14 h-14 rounded-xl object-cover" />}
                <p className="font-bold text-slate-900">{c.product.title}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) return <div className="aspect-video rounded-xl overflow-hidden"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen /></div>;
  if (vimeo) return <div className="aspect-video rounded-xl overflow-hidden"><iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vimeo[1]}`} allowFullScreen /></div>;
  return <video controls src={url} className="w-full rounded-xl bg-black" />;
}
