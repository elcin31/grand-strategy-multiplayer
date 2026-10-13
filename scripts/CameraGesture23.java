import android.os.SystemClock;
import android.view.InputEvent;
import android.view.MotionEvent;
import android.view.InputDevice;
import java.lang.reflect.Method;

/** QA shell driver. Constant-speed pan; real two-pointer zoom/pan, no app hooks. */
public class CameraGesture23 {
  static Object manager; static Method inject; static long down;
  static void event(int action,int count,float radius,float cx,float cy) throws Exception {
    MotionEvent.PointerProperties[] p=new MotionEvent.PointerProperties[count];
    MotionEvent.PointerCoords[] c=new MotionEvent.PointerCoords[count];
    for(int i=0;i<count;i++){
      p[i]=new MotionEvent.PointerProperties();p[i].id=i;p[i].toolType=MotionEvent.TOOL_TYPE_FINGER;
      c[i]=new MotionEvent.PointerCoords();c[i].pressure=1;c[i].size=1;
      c[i].x=count==1?cx:cx+(i==0?-radius:radius);c[i].y=cy;
    }
    MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,count,p,c,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
    inject.invoke(manager,e,0);e.recycle();
  }
  public static void main(String[] args) throws Exception {
    Class<?> cls;
    try{cls=Class.forName("android.hardware.input.InputManagerGlobal");}catch(ClassNotFoundException e){cls=Class.forName("android.hardware.input.InputManager");}
    manager=cls.getMethod("getInstance").invoke(null);inject=cls.getMethod("injectInputEvent",InputEvent.class,int.class);
    String kind=args[0];int cycles=Integer.parseInt(args[1]);
    if(!kind.matches("pan|in|out|combined|lod")||cycles<1||cycles>50)throw new IllegalArgumentException("Invalid QA gesture");
    boolean pinch=!kind.equals("pan");
    float focalX=args.length>2?Float.parseFloat(args[2]):560,focalY=args.length>3?Float.parseFloat(args[3]):320;
    if(focalX<200||focalX>1000||focalY<150||focalY>500)throw new IllegalArgumentException("Invalid QA focal point");
    StringBuilder timing=new StringBuilder("{\"kind\":\"").append(kind).append("\",\"cycles\":[");
    for(int cycle=0;cycle<cycles;cycle++){
      down=SystemClock.uptimeMillis();long downNs=System.nanoTime();
      float radius=kind.equals("out")?150:25,cx=pinch?focalX:400,cy=focalY;
      event(MotionEvent.ACTION_DOWN,1,radius,pinch?cx-radius:cx,cy);
      if(pinch)event(MotionEvent.ACTION_POINTER_DOWN+(1<<8),2,radius,cx,cy);
      for(int frame=0;frame<=120;frame++){
        float t=frame/120f,triangle=t<.5f?2*t:2*(1-t);
        radius=kind.equals("in")?25+125*t:kind.equals("out")?150-125*t:25+100*triangle;
        cx=pinch?(kind.equals("combined")?focalX+100*triangle:focalX):400+400*triangle;
        cy=kind.equals("combined")?focalY+35*triangle:focalY;
        long due=down+frame*16;if(due>SystemClock.uptimeMillis())SystemClock.sleep(due-SystemClock.uptimeMillis());
        event(MotionEvent.ACTION_MOVE,pinch?2:1,radius,cx,cy);
      }
      if(pinch)event(MotionEvent.ACTION_POINTER_UP+(1<<8),2,radius,cx,cy);
      event(MotionEvent.ACTION_UP,1,radius,pinch?cx-radius:cx,cy);
      if(cycle>0)timing.append(',');timing.append("{\"downNs\":").append(downNs).append(",\"upNs\":").append(System.nanoTime()).append('}');
    }
    System.out.println("DOMINION_GESTURE_TIMING "+timing.append("]}"));
  }
}
