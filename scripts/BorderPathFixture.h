#pragma once
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <set>
#include <stdexcept>
#include <string>
#include <sys/resource.h>
#include <vector>
#include "include/core/SkCanvas.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkPicture.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkSurface.h"

struct Chunk {SkPathBuilder outer,inner;SkPath fixedOuter,fixedInner;};
template<class T>T read(std::ifstream& stream){T v;stream.read(reinterpret_cast<char*>(&v),sizeof(v));if(!stream)throw std::runtime_error("Truncated fixture");return v;}
std::vector<Chunk> load(const char* file){
  std::ifstream stream(file,std::ios::binary);
  if(read<uint32_t>(stream)!=0x42333244||read<uint32_t>(stream)!=1)throw std::runtime_error("Wrong D23B fixture");
  const auto count=read<uint32_t>(stream);if(!count||count>1024)throw std::runtime_error("Invalid chunk count");
  std::vector<Chunk> chunks(count);uint64_t total=0;
  for(auto& c:chunks){
    const auto outer=read<uint32_t>(stream),inner=read<uint32_t>(stream);total+=outer+inner;
    if(total>2000000)throw std::runtime_error("Oversized fixture");
    for(uint32_t i=0;i<outer+inner;++i){
      float p[4];for(auto& x:p){x=read<float>(stream);if(!std::isfinite(x))throw std::runtime_error("Nonfinite edge");}
      auto& b=i<outer?c.outer:c.inner;b.moveTo(p[0],p[1]).lineTo(p[2],p[3]);
    }
    c.fixedOuter=c.outer.snapshot();c.fixedInner=c.inner.snapshot();
  }
  if(stream.peek()!=std::char_traits<char>::eof())throw std::runtime_error("Trailing fixture data");
  return chunks;
}
sk_sp<SkPicture> record(const std::vector<Chunk>& chunks,float zoom,bool performance,bool reuse){
  SkPictureRecorder recorder;auto* canvas=recorder.beginRecording(SkRect::MakeWH(1440,720));
  SkPaint p;p.setAntiAlias(true);p.setStyle(SkPaint::kStroke_Style);
  const auto t=std::clamp((zoom-(performance?4.f:2.7f))/(7.f-(performance?4.f:2.7f)),0.f,1.f);
  const auto detail=t*t*(3-2*t);
  for(const auto& c:chunks){
    if(detail>0){p.setColor(0xff232b29);p.setAlphaf(.48f*detail);p.setStrokeWidth(.65f/zoom);canvas->drawPath(reuse?c.fixedInner:c.inner.snapshot(),p);}
    // Preserve original paint call order, including setColor's alpha reset.
    p.setAlphaf(.9f);p.setColor(0xff131e23);p.setStrokeWidth((performance?.8f:1.f)*1.65f/zoom);canvas->drawPath(reuse?c.fixedOuter:c.outer.snapshot(),p);
    p.setAlphaf(.42f);p.setColor(0xffe3c991);p.setStrokeWidth(.5f/zoom);canvas->drawPath(reuse?c.fixedOuter:c.outer.snapshot(),p);
  }
  return recorder.finishRecordingAsPicture();
}
std::vector<uint32_t> pixels(const sk_sp<SkPicture>& picture,float zoom){
  constexpr int w=1280,h=720;const auto info=SkImageInfo::MakeN32Premul(w,h);
  auto s=SkSurfaces::Raster(info);if(!s)throw std::runtime_error("No native CPU raster surface");
  auto* canvas=s->getCanvas();canvas->clear(0xff0b2030);canvas->translate(w/2.f,h/2.f);canvas->scale(zoom,zoom*.92f);canvas->translate(-800,-160);canvas->drawPicture(picture);
  std::vector<uint32_t> result(w*h);if(!s->readPixels(info,result.data(),w*4,0,0))throw std::runtime_error("No native pixels");return result;
}
