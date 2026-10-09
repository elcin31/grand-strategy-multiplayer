import android.os.SystemClock;
import android.view.InputEvent;
import android.view.MotionEvent;
import android.view.InputDevice;
import java.lang.reflect.Method;

/** Shell-only real one/two-pointer input, identical for baseline and candidate. */
public class CameraGesture {
  static Object manager;
  static Method inject;
  static long down;
  static void event(int action, int count, float radius) throws Exception {
    MotionEvent.PointerProperties[] p = new MotionEvent.PointerProperties[count];
    MotionEvent.PointerCoords[] c = new MotionEvent.PointerCoords[count];
    for (int i=0;i<count;i++) {
      p[i] = new MotionEvent.PointerProperties(); p[i].id=i; p[i].toolType=MotionEvent.TOOL_TYPE_FINGER;
      c[i] = new MotionEvent.PointerCoords(); c[i].pressure=1; c[i].size=1;
      c[i].x = count==1 ? radius : 520+(i==0?-radius:radius); c[i].y=350;
    }
    MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,count,p,c,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
    inject.invoke(manager,e,0); e.recycle();
  }
  public static void main(String[] args) throws Exception {
    Class<?> cls;
    try {cls=Class.forName("android.hardware.input.InputManagerGlobal");}
    catch(ClassNotFoundException e){cls=Class.forName("android.hardware.input.InputManager");}
    manager=cls.getMethod("getInstance").invoke(null);
    inject=cls.getMethod("injectInputEvent",InputEvent.class,int.class);
    boolean pinch=args[0].equals("pinch"); int cycles=Integer.parseInt(args[1]);
    for(int cycle=0;cycle<cycles;cycle++) {
      down=SystemClock.uptimeMillis(); event(MotionEvent.ACTION_DOWN,1,pinch?475:360);
      if(pinch)event(MotionEvent.ACTION_POINTER_DOWN+(1<<8),2,45);
      for(int frame=0;frame<=120;frame++) {
        float phase=frame/120f;
        float r=pinch?45+80*(float)Math.sin(Math.PI*phase):360+280*(float)Math.sin(Math.PI*phase);
        event(MotionEvent.ACTION_MOVE,pinch?2:1,r);
        long due=down+frame*16; if(due>SystemClock.uptimeMillis())SystemClock.sleep(due-SystemClock.uptimeMillis());
      }
      if(pinch)event(MotionEvent.ACTION_POINTER_UP+(1<<8),2,45);
      event(MotionEvent.ACTION_UP,1,pinch?475:360);SystemClock.sleep(150);
    }
    System.out.println("PASS: "+args[0]+" real pointer cycles="+cycles);
  }
}
