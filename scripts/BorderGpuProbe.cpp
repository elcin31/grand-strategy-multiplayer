// Diagnostic only: actual pinned Ganesh/OpenGL with original Dominion borders.
// A pbuffer has no Android compositor. These times are NOT displayed frame time.
#include "BorderPathFixture.h"
#include <EGL/egl.h>
#include <GLES2/gl2.h>
#include "include/gpu/ganesh/GrDirectContext.h"
#include "include/gpu/ganesh/SkSurfaceGanesh.h"
#include "include/gpu/ganesh/gl/GrGLBackendSurface.h"
#include "include/gpu/ganesh/gl/GrGLDirectContext.h"
#include "src/gpu/ganesh/gl/GrGLDefines.h"

struct EglTarget {
  EGLDisplay display=EGL_NO_DISPLAY;
  EGLSurface surface=EGL_NO_SURFACE;
  EGLContext context=EGL_NO_CONTEXT;
  EglTarget(){
    display=eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if(display==EGL_NO_DISPLAY||!eglInitialize(display,nullptr,nullptr))throw std::runtime_error("No EGL display");
    const EGLint attrs[]={EGL_SURFACE_TYPE,EGL_PBUFFER_BIT,EGL_RENDERABLE_TYPE,EGL_OPENGL_ES2_BIT,
      EGL_RED_SIZE,8,EGL_GREEN_SIZE,8,EGL_BLUE_SIZE,8,EGL_ALPHA_SIZE,8,EGL_STENCIL_SIZE,8,EGL_NONE};
    EGLConfig config;EGLint count;
    if(!eglChooseConfig(display,attrs,&config,1,&count)||count!=1)throw std::runtime_error("No stencil RGBA EGL config");
    const EGLint ctx[]={EGL_CONTEXT_CLIENT_VERSION,2,EGL_NONE},size[]={EGL_WIDTH,1280,EGL_HEIGHT,720,EGL_NONE};
    context=eglCreateContext(display,config,EGL_NO_CONTEXT,ctx);
    surface=eglCreatePbufferSurface(display,config,size);
    if(context==EGL_NO_CONTEXT||surface==EGL_NO_SURFACE||!eglMakeCurrent(display,surface,surface,context))throw std::runtime_error("No EGL target");
  }
  ~EglTarget(){if(display!=EGL_NO_DISPLAY){eglMakeCurrent(display,EGL_NO_SURFACE,EGL_NO_SURFACE,EGL_NO_CONTEXT);if(surface!=EGL_NO_SURFACE)eglDestroySurface(display,surface);if(context!=EGL_NO_CONTEXT)eglDestroyContext(display,context);eglTerminate(display);}}
};
double elapsed(std::chrono::steady_clock::time_point start){return std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();}

int main(int argc,char** argv){try{
  if(argc!=3)throw std::runtime_error("Usage: gpu-probe fixture.bin mutable|retained");
  const bool reuse=std::string(argv[2])=="retained";
  if(!reuse&&std::string(argv[2])!="mutable")throw std::runtime_error("Invalid mode");
  auto chunks=load(argv[1]);
  for(auto& c:chunks){c.fixedOuter.updateBoundsCache();c.fixedInner.updateBoundsCache();}
  EglTarget egl;auto context=GrDirectContexts::MakeGL();if(!context)throw std::runtime_error("No pinned Skia GL context");
  GLint samples,stencil;glGetIntegerv(GL_SAMPLES,&samples);glGetIntegerv(GL_STENCIL_BITS,&stencil);
  GrGLFramebufferInfo info;info.fFBOID=0;info.fFormat=GR_GL_RGBA8;
  auto rt=GrBackendRenderTargets::MakeGL(1280,720,samples,stencil,info);
  auto surface=SkSurfaces::WrapBackendRenderTarget(context.get(),rt,kBottomLeft_GrSurfaceOrigin,kRGBA_8888_SkColorType,nullptr);
  if(!surface)throw std::runtime_error("No GPU-backed surface");
  const char* renderer=reinterpret_cast<const char*>(glGetString(GL_RENDERER));
  std::cout<<"{\"mode\":\""<<argv[2]<<"\",\"diagnosticOnly\":true,\"pbufferHasCompositor\":false,\"physicalRedmiTest\":false,\"glRenderer\":\""<<(renderer?renderer:"unknown")<<"\",\"cacheLimitBytes\":"<<context->getResourceCacheLimit()<<",\"frames\":[";
  sk_sp<SkPicture> picture;float preparedZoom=0;
  for(int frame=0;frame<240;++frame){
    // Two fixed pan cycles followed by two World/Province transitions.
    const float t=(frame%60)/59.f;
    const bool pan=frame<120;
    const float zoom=pan?3.5f:(t<.5f?.9f+22.2f*t:12.f-22.2f*(t-.5f));
    const float x=pan?800.f+(t<.5f?80*t:80*(1-t)):800.f;
    double recordingMs=0;
    if(frame%8==0||!picture){auto start=std::chrono::steady_clock::now();preparedZoom=zoom;picture=record(chunks,preparedZoom,false,reuse);recordingMs=elapsed(start);}
    auto* canvas=surface->getCanvas();auto start=std::chrono::steady_clock::now();
    canvas->clear(0xff0b2030);canvas->save();canvas->translate(640,360);canvas->scale(zoom,zoom*.92f);canvas->translate(-x,-160);canvas->drawPicture(picture);canvas->restore();
    const double drawMs=elapsed(start);start=std::chrono::steady_clock::now();context->flushAndSubmit();const double flushMs=elapsed(start);
    start=std::chrono::steady_clock::now();glFinish();const double completionMs=elapsed(start);
    if(glGetError()!=GL_NO_ERROR)throw std::runtime_error("GL error after real GPU completion");
    int resources;size_t bytes;context->getResourceCacheUsage(&resources,&bytes);
    std::cout<<(frame?",":"")<<"{\"frame\":"<<frame<<",\"scenario\":\""<<(pan?"pan":"zoom")<<"\",\"zoom\":"<<zoom<<",\"recordMs\":"<<recordingMs<<",\"drawMs\":"<<drawMs<<",\"flushMs\":"<<flushMs<<",\"completionMs\":"<<completionMs<<",\"cacheBytes\":"<<bytes<<",\"cacheResources\":"<<resources<<",\"purgeableBytes\":"<<context->getResourceCachePurgeableBytes()<<"}";
  }
  rusage usage{};getrusage(RUSAGE_SELF,&usage);
  std::cout<<"],\"peakRssKiB\":"<<usage.ru_maxrss<<",\"note\":\"Actual Ganesh draw, flush and glFinish costs; no texture atlas, UI gestures, compositor or performance acceptance. Same fixed fixture and context defaults in every process.\"}\n";
  return 0;
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
