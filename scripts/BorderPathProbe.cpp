#include "BorderPathFixture.h"

int main(int argc,char** argv){try{
  if(argc!=3)throw std::runtime_error("Usage: probe fixture.bin mutable|retained");
  const bool reuse=std::string(argv[2])=="retained";
  if(!reuse&&std::string(argv[2])!="mutable")throw std::runtime_error("Invalid mode");
  auto chunks=load(argv[1]);std::set<uint32_t> mutableIds,retainedIds;
  auto found=std::find_if(chunks.begin(),chunks.end(),[](const Chunk& c){return c.outer.countPoints()>0;});
  if(found==chunks.end())throw std::runtime_error("No original outer path");
  for(int i=0;i<64;i++){const auto a=found->outer.snapshot(),b=found->fixedOuter;if(!(a==b))throw std::runtime_error("Snapshot geometry differs");mutableIds.insert(a.getGenerationID());retainedIds.insert(b.getGenerationID());}
  if(retainedIds.size()!=1)throw std::runtime_error("Retained identity changed");
  uint64_t changes=0;for(bool performance:{false,true})for(float zoom:{.9f,3.5f,7.f,12.f}){
    const auto a=pixels(record(chunks,zoom,performance,false),zoom),b=pixels(record(chunks,zoom,performance,true),zoom);
    for(size_t i=0;i<a.size();i++)changes+=a[i]!=b[i];
  }
  if(changes)throw std::runtime_error("Original raster pixels changed");
  // A finished native picture must retain geometry after every source holder
  // and builder is released. Mutating a builder cannot modify a prior snapshot.
  auto lifetimeChunks=load(argv[1]);auto kept=record(lifetimeChunks,3.5f,false,true);const auto expected=pixels(kept,3.5f);
  auto old=lifetimeChunks[0].fixedOuter;lifetimeChunks[0].outer.moveTo(5,5).lineTo(10,10);
  if(!(old==lifetimeChunks[0].fixedOuter))throw std::runtime_error("Builder mutation changed immutable snapshot");
  if(pixels(record(lifetimeChunks,3.5f,false,true),3.5f)!=expected)throw std::runtime_error("Reused snapshot changed after source mutation");
  lifetimeChunks.clear();if(pixels(kept,3.5f)!=expected)throw std::runtime_error("Picture lost retained geometry");
  std::vector<double> times;std::vector<sk_sp<SkPicture>> live;size_t pathBytes=0;
  for(const auto& c:chunks)pathBytes+=c.fixedOuter.approximateBytesUsed()+c.fixedInner.approximateBytesUsed();
  for(int i=0;i<64;i++){
    const auto start=std::chrono::steady_clock::now();live.push_back(record(chunks,3.5f,false,reuse));
    times.push_back(std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count());
  }
  std::sort(times.begin(),times.end());rusage usage{};getrusage(RUSAGE_SELF,&usage);
  std::cout<<"{\"mode\":\""<<argv[2]<<"\",\"chunks\":"<<chunks.size()<<",\"records\":64,\"mutableUniqueIds\":"<<mutableIds.size()<<",\"retainedUniqueIds\":"<<retainedIds.size()<<",\"changedNativeRasterPixels\":"<<changes<<",\"pictureRetainsReleasedGeometry\":true,\"snapshotSurvivesMutation\":true,\"pathBytes\":"<<pathBytes<<",\"recordP50Ms\":"<<times[32]<<",\"recordP95Ms\":"<<times[60]<<",\"recordP99Ms\":"<<times[63]<<",\"peakRssKiB\":"<<usage.ru_maxrss<<",\"physicalRedmiTest\":false,\"note\":\"Native Skia identity/CPU recording/lifetime probe only; not displayed frame time, GPU workload or camera acceptance.\"}\n";
  return 0;
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
